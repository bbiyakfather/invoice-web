/**
 * Notion API 응답 데이터 파싱 및 변환 유틸리티
 * Notion 데이터 구조를 비즈니스 도메인 타입으로 변환
 */

import type {
  NotionPage,
  InvoicePageProperties,
  ItemPageProperties,
} from '@/types/notion'
import type { Invoice, InvoiceItem, InvoiceStatus } from '@/types/invoice'
import type { UpdatePageParameters } from '@notionhq/client/build/src/api-endpoints'

/**
 * Notion 견적서 페이지를 Invoice 객체로 변환
 * @param page - Notion 견적서 페이지
 * @param itemPages - Notion 항목 페이지 배열
 * @returns 변환된 Invoice 객체
 */
export function transformNotionToInvoice(
  page: NotionPage & { properties: InvoicePageProperties },
  itemPages: Array<NotionPage & { properties: ItemPageProperties }>
): Invoice {
  const props = page.properties

  // null 체크와 기본값 처리
  const invoiceNumber =
    extractPlainText(props.invoice_number?.title) || 'INV-UNKNOWN'
  const clientName = extractPlainText(props.client_name?.rich_text) || '미지정'
  // 사업자번호는 옵셔널 속성: 없으면 빈 문자열 (하위호환)
  const businessNumber =
    extractPlainText(props.business_number?.rich_text) || ''
  const issueDate =
    props.issue_date?.date?.start || new Date().toISOString().split('T')[0]
  const validUntil =
    props.valid_until?.date?.start || getDefaultValidUntil(issueDate)
  const totalAmount =
    props.total_amount?.number || calculateTotalFromItems(itemPages)
  const status = mapStatus(props.status?.select?.name)

  // 항목 변환
  const items = itemPages.map(transformNotionToItem)

  return {
    id: page.id,
    invoiceNumber,
    clientName,
    businessNumber,
    issueDate,
    validUntil,
    totalAmount,
    status,
    items,
  }
}

/**
 * Notion 항목 페이지를 InvoiceItem 객체로 변환
 * @param page - Notion 항목 페이지
 * @returns 변환된 InvoiceItem 객체
 */
function transformNotionToItem(
  page: NotionPage & { properties: ItemPageProperties }
): InvoiceItem {
  const props = page.properties

  // null 체크와 기본값 처리
  const description = extractPlainText(props.item_name?.title) || '항목명 없음'
  const quantity = props.quantity?.number || 0
  const unitPrice = props.unit_price?.number || 0
  const amount = props.amount?.number || quantity * unitPrice

  return {
    id: page.id,
    description,
    quantity,
    unitPrice,
    amount,
  }
}

/**
 * Invoice 부분 데이터를 Notion 견적서 페이지 properties payload로 변환 (역방향)
 * 제공된(undefined가 아닌) 필드만 payload에 포함하므로 부분 수정에 사용 가능하다.
 * @param data - 수정할 Invoice 부분 데이터
 * @returns notion.pages.update의 properties에 전달 가능한 객체
 */
export function buildInvoicePropertiesPayload(
  data: Partial<Invoice>
): UpdatePageParameters['properties'] {
  const properties: Record<string, unknown> = {}

  if (data.clientName !== undefined) {
    properties.client_name = {
      rich_text: [{ text: { content: data.clientName } }],
    }
  }
  if (data.businessNumber !== undefined) {
    properties.business_number = {
      rich_text: [{ text: { content: data.businessNumber } }],
    }
  }
  if (data.issueDate !== undefined) {
    properties.issue_date = { date: { start: data.issueDate } }
  }
  if (data.validUntil !== undefined) {
    properties.valid_until = { date: { start: data.validUntil } }
  }
  if (data.totalAmount !== undefined) {
    properties.total_amount = { number: data.totalAmount }
  }
  if (data.status !== undefined) {
    properties.status = { select: { name: data.status } }
  }

  return properties as UpdatePageParameters['properties']
}

/**
 * InvoiceItem 부분 데이터를 Notion 항목 페이지 properties payload로 변환 (역방향)
 * @param item - 항목 데이터 (id 제외 부분)
 * @param invoiceId - 연결할 견적서 페이지 ID (생성 시 relation 설정용, 선택)
 * @returns notion 항목 페이지 properties 객체
 */
export function buildItemPropertiesPayload(
  item: Partial<Omit<InvoiceItem, 'id'>>,
  invoiceId?: string
): UpdatePageParameters['properties'] {
  const properties: Record<string, unknown> = {}

  if (item.description !== undefined) {
    properties.item_name = {
      title: [{ text: { content: item.description } }],
    }
  }
  if (item.quantity !== undefined) {
    properties.quantity = { number: item.quantity }
  }
  if (item.unitPrice !== undefined) {
    properties.unit_price = { number: item.unitPrice }
  }
  if (item.amount !== undefined) {
    properties.amount = { number: item.amount }
  }
  if (invoiceId !== undefined) {
    properties.invoices = { relation: [{ id: invoiceId }] }
  }

  return properties as UpdatePageParameters['properties']
}

/**
 * Notion select 상태값을 InvoiceStatus 타입으로 검증/매핑
 * Notion 옵션 값이 이미 영문(pending/approved/rejected)이므로 유효성만 검증
 * @param statusName - Notion status select 값
 * @returns 영문 상태값 (유효하지 않으면 'pending')
 */
function mapStatus(statusName: string | null | undefined): InvoiceStatus {
  const validStatuses: InvoiceStatus[] = ['pending', 'approved', 'rejected']
  if (statusName && validStatuses.includes(statusName as InvoiceStatus)) {
    return statusName as InvoiceStatus
  }
  return 'pending'
}

/**
 * Notion 텍스트 배열에서 plain text 추출
 * @param textArray - Notion 텍스트 객체 배열
 * @returns 결합된 plain text 문자열
 */
function extractPlainText(
  textArray: Array<{ plain_text: string }> | undefined | null
): string {
  if (!textArray || textArray.length === 0) {
    return ''
  }

  return textArray.map(text => text.plain_text).join('')
}

/**
 * 기본 유효기간 계산 (발행일로부터 7일 후)
 * @param issueDate - 발행일 (ISO 8601 형식)
 * @returns 유효기간 (ISO 8601 형식)
 */
function getDefaultValidUntil(issueDate: string): string {
  try {
    const date = new Date(issueDate)
    date.setDate(date.getDate() + 7)
    return date.toISOString().split('T')[0]
  } catch {
    // 날짜 파싱 실패 시 현재 날짜 + 7일
    const date = new Date()
    date.setDate(date.getDate() + 7)
    return date.toISOString().split('T')[0]
  }
}

/**
 * 항목들의 금액 합계 계산
 * @param itemPages - 항목 페이지 배열
 * @returns 총 금액
 */
function calculateTotalFromItems(
  itemPages: Array<NotionPage & { properties: ItemPageProperties }>
): number {
  return itemPages.reduce((total, page) => {
    const amount = page.properties.amount?.number || 0
    return total + amount
  }, 0)
}

/**
 * 날짜 문자열 포맷 검증 및 변환
 * @param dateString - 날짜 문자열
 * @returns ISO 8601 형식의 날짜 문자열
 */
export function normalizeDate(dateString: string | null | undefined): string {
  if (!dateString) {
    return new Date().toISOString().split('T')[0]
  }

  try {
    // Notion은 다양한 날짜 형식을 반환할 수 있음
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date')
    }
    return date.toISOString().split('T')[0]
  } catch {
    console.warn(`날짜 파싱 실패: ${dateString}`)
    return new Date().toISOString().split('T')[0]
  }
}

/**
 * 숫자 값 안전하게 파싱
 * @param value - 변환할 값
 * @param defaultValue - 기본값
 * @returns 파싱된 숫자
 */
export function parseNumber(value: unknown, defaultValue: number = 0): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    if (!isNaN(parsed)) {
      return parsed
    }
  }

  return defaultValue
}
