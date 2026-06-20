/**
 * Notion API 서비스 레이어
 * 견적서 데이터 조회 및 처리 로직
 */

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { createCachedInvoiceFetcher, getInvoiceWithDedup } from '@/lib/cache'
import { ERROR_MESSAGES } from '@/lib/constants'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { getDataSourceId, notion } from '@/lib/notion'
import {
  buildInvoicePropertiesPayload,
  buildItemPropertiesPayload,
  transformNotionToInvoice,
} from '@/lib/utils/notion-parser'
import type {
  ClientSummary,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
} from '@/types/invoice'
import type {
  InvoicePageProperties,
  ItemPageProperties,
  NotionPage,
} from '@/types/notion'
import { isInvoicePage, isItemPage } from '@/types/notion'
import type {
  CreatePageParameters,
  GetPageResponse,
} from '@notionhq/client/build/src/api-endpoints'

/**
 * 견적서 검색 필터 인터페이스
 */
export interface InvoiceFilters {
  /** 클라이언트명 또는 견적서 번호 검색어 */
  query?: string
  /** 견적서 상태 필터 */
  status?: InvoiceStatus
  /** 발행일 시작 범위 (ISO 8601 형식: YYYY-MM-DD) */
  dateFrom?: string
  /** 발행일 종료 범위 (ISO 8601 형식: YYYY-MM-DD) */
  dateTo?: string
}

/**
 * 견적서 페이지 조회
 * @param pageId - Notion 페이지 ID
 * @returns Invoice 페이지 데이터
 * @throws Error - 페이지를 찾을 수 없거나 유효하지 않은 경우
 */
async function fetchInvoicePage(
  pageId: string
): Promise<NotionPage & { properties: InvoicePageProperties }> {
  try {
    const response = await notion.pages.retrieve({ page_id: pageId })

    // PartialPageObjectResponse 제외 (아카이브된 페이지 등)
    if (!('properties' in response)) {
      throw new Error(ERROR_MESSAGES.INVALID_INVOICE_DATA)
    }

    const page = response as NotionPage

    // 타입 가드를 사용한 유효성 검증
    if (!isInvoicePage(page)) {
      throw new Error(ERROR_MESSAGES.INVALID_INVOICE_DATA)
    }

    return page
  } catch (error) {
    const errorObj = error as { code?: string; message?: string }
    logger.error('Notion API 오류', {
      pageId,
      errorCode: errorObj.code,
    })

    // Notion API 에러 코드 처리
    if (errorObj.code === 'object_not_found') {
      throw new Error(ERROR_MESSAGES.INVOICE_NOT_FOUND)
    }

    // 커스텀 에러 메시지가 있으면 그대로 전달
    if (
      errorObj.message &&
      Object.values(ERROR_MESSAGES).includes(
        errorObj.message as (typeof ERROR_MESSAGES)[keyof typeof ERROR_MESSAGES]
      )
    ) {
      throw error
    }

    // 기타 에러
    throw new Error(ERROR_MESSAGES.NOTION_API_ERROR)
  }
}

/**
 * 견적 항목들 조회 (병렬 처리)
 * @param itemIds - 항목 페이지 ID 배열
 * @returns Item 페이지 데이터 배열
 */
async function fetchInvoiceItems(
  itemIds: string[]
): Promise<Array<NotionPage & { properties: ItemPageProperties }>> {
  if (itemIds.length === 0) {
    return []
  }

  // Promise.allSettled를 사용하여 일부 실패해도 계속 진행
  const results = await Promise.allSettled(
    itemIds.map(id => notion.pages.retrieve({ page_id: id }))
  )

  // 성공한 결과만 필터링하고 타입 검증
  const items = results
    .filter(
      (result): result is PromiseFulfilledResult<GetPageResponse> =>
        result.status === 'fulfilled'
    )
    .map(result => result.value)
    .filter((page): page is NotionPage => 'properties' in page)
    .filter(isItemPage)

  // 실패한 항목이 있으면 경고 로그
  const failedCount = results.filter(r => r.status === 'rejected').length
  if (failedCount > 0) {
    logger.warn('견적 항목 조회 실패', {
      failedCount,
      totalCount: itemIds.length,
    })
  }

  return items
}

/**
 * 재시도 로직 구현
 * @param fn - 실행할 비동기 함수
 * @param maxRetries - 최대 재시도 횟수 (기본값: 3)
 * @returns 함수 실행 결과
 * @throws Error - 최대 재시도 횟수 초과 시
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | undefined

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // 마지막 시도이거나 재시도 불가능한 에러인 경우
      if (
        i === maxRetries - 1 ||
        lastError.message === ERROR_MESSAGES.INVOICE_NOT_FOUND ||
        lastError.message === ERROR_MESSAGES.INVALID_INVOICE_DATA
      ) {
        throw lastError
      }

      // 지수 백오프: 1초, 2초, 4초...
      const delay = Math.min(1000 * Math.pow(2, i), 5000)
      logger.warn('API 재시도', {
        attempt: i + 1,
        maxRetries: maxRetries - 1,
        delayMs: delay,
      })
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error('Retry failed')
}

/**
 * Notion에서 견적서 데이터 조회 (메인 export 함수)
 * @param pageId - 견적서 페이지 ID
 * @returns 변환된 Invoice 객체
 * @throws Error - 조회 실패 시
 */
export async function getInvoiceFromNotion(pageId: string): Promise<Invoice> {
  return withRetry(async () => {
    // 1. 견적서 페이지 조회
    const page = await fetchInvoicePage(pageId)

    // 2. 관련 항목 ID 추출
    const itemIds = page.properties.items?.relation?.map(r => r.id) || []

    // 3. 항목 데이터 병렬 조회
    const items = await fetchInvoiceItems(itemIds)

    // 4. 데이터 변환 후 반환
    return transformNotionToInvoice(page, items)
  })
}

/**
 * 캐싱이 적용된 견적서 조회 함수
 * unstable_cache로 60초간 캐싱됩니다.
 */
const getCachedInvoiceFromNotion =
  createCachedInvoiceFetcher(getInvoiceFromNotion)

/**
 * 최적화된 견적서 조회 (캐싱 + Request Deduplication)
 * 외부에서 사용하는 메인 함수
 *
 * @param pageId - 견적서 페이지 ID
 * @returns Invoice 객체
 *
 * @example
 * ```typescript
 * // 페이지 컴포넌트에서 사용
 * const invoice = await getOptimizedInvoice(pageId)
 * ```
 */
export async function getOptimizedInvoice(pageId: string): Promise<Invoice> {
  return getInvoiceWithDedup(pageId, getCachedInvoiceFromNotion)
}

/**
 * 견적서 목록 조회 결과 인터페이스
 */
export interface InvoiceListResult {
  /** 견적서 배열 */
  invoices: Invoice[]
  /** 다음 페이지 커서 */
  nextCursor: string | null
  /** 다음 페이지 존재 여부 */
  hasMore: boolean
}

/**
 * Notion 데이터베이스에서 견적서 목록 조회
 * @param pageSize - 페이지당 항목 수 (기본값: 10, 최대: 100)
 * @param startCursor - 페이지네이션 시작 커서
 * @param sortBy - 정렬 기준 ('issue_date' | 'total_amount')
 * @returns InvoiceListResult 객체
 * @throws Error - 조회 실패 시
 */
export async function getInvoicesFromNotion(
  pageSize: number = 10,
  startCursor?: string,
  sortBy?: 'issue_date' | 'total_amount'
): Promise<InvoiceListResult> {
  try {
    // Notion API 페이지 크기 제한 (최대 100)
    const limitedPageSize = Math.min(pageSize, 100)

    // 정렬 속성 매핑
    const sortProperty = sortBy === 'issue_date' ? 'issue_date' : 'total_amount'
    const sortDirection = 'descending' as const

    // v5에서는 data_source_id 필요
    const dataSourceId = await getDataSourceId()

    // Notion Data Source Query (v5)
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      page_size: limitedPageSize,
      start_cursor: startCursor || undefined,
      sorts: [
        {
          property: sortProperty,
          direction: sortDirection,
        },
      ],
    })

    // 병렬 처리로 모든 견적서의 항목 조회
    const invoices = await Promise.all(
      response.results
        .filter((page): page is NotionPage => 'properties' in page)
        .filter(isInvoicePage)
        .map(async page => {
          const itemIds = page.properties.items?.relation?.map(r => r.id) || []
          const items = await fetchInvoiceItems(itemIds)
          return transformNotionToInvoice(page, items)
        })
    )

    logger.info('견적서 목록 조회 성공', {
      count: invoices.length,
      hasMore: response.has_more,
      sortBy,
    })

    return {
      invoices,
      nextCursor: response.next_cursor,
      hasMore: response.has_more,
    }
  } catch (error) {
    const errorObj = error as Error
    logger.error('견적서 목록 조회 실패', {
      error: errorObj.message,
      stack: errorObj.stack,
      name: errorObj.name,
    })
    throw new Error('견적서 목록을 불러올 수 없습니다')
  }
}

/**
 * Notion 데이터베이스에서 견적서 검색
 * @param filters - 검색 필터 (검색어, 상태, 날짜 범위)
 * @param pageSize - 페이지당 항목 수 (기본값: 10, 최대: 100)
 * @param startCursor - 페이지네이션 시작 커서
 * @returns InvoiceListResult 객체
 * @throws Error - 검색 실패 시
 */
export async function searchInvoices(
  filters: InvoiceFilters,
  pageSize: number = 10,
  startCursor?: string
): Promise<InvoiceListResult> {
  try {
    // Notion API 페이지 크기 제한 (최대 100)
    const limitedPageSize = Math.min(pageSize, 100)

    // Notion Filter 배열 구성
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const notionFilters: any[] = []

    // 1. 클라이언트명 또는 견적서 번호 검색
    if (filters.query) {
      notionFilters.push({
        or: [
          {
            property: 'client_name',
            rich_text: { contains: filters.query },
          },
          {
            property: 'invoice_number',
            title: { contains: filters.query },
          },
        ],
      })
    }

    // 2. 상태 필터 (Notion 옵션 값이 InvoiceStatus와 동일한 영문이므로 직접 사용)
    if (filters.status) {
      notionFilters.push({
        property: 'status',
        select: { equals: filters.status },
      })
    }

    // 3. 날짜 범위 필터
    if (filters.dateFrom || filters.dateTo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dateFilter: any = { property: 'issue_date', date: {} }

      if (filters.dateFrom) {
        dateFilter.date.on_or_after = filters.dateFrom
      }
      if (filters.dateTo) {
        dateFilter.date.on_or_before = filters.dateTo
      }

      notionFilters.push(dateFilter)
    }

    // v5에서는 data_source_id 필요
    const dataSourceId = await getDataSourceId()

    // Notion Data Source Query (v5, 필터 적용)
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      page_size: limitedPageSize,
      start_cursor: startCursor || undefined,
      filter:
        notionFilters.length > 0
          ? {
              and: notionFilters,
            }
          : undefined,
      sorts: [
        {
          property: 'issue_date',
          direction: 'descending',
        },
      ],
    })

    // 병렬 처리로 모든 견적서의 항목 조회
    const invoices = await Promise.all(
      response.results
        .filter((page): page is NotionPage => 'properties' in page)
        .filter(isInvoicePage)
        .map(async page => {
          const itemIds = page.properties.items?.relation?.map(r => r.id) || []
          const items = await fetchInvoiceItems(itemIds)
          return transformNotionToInvoice(page, items)
        })
    )

    logger.info('견적서 검색 성공', {
      count: invoices.length,
      hasMore: response.has_more,
      filters,
    })

    return {
      invoices,
      nextCursor: response.next_cursor,
      hasMore: response.has_more,
    }
  } catch (error) {
    const errorObj = error as Error
    logger.error('견적서 검색 실패', {
      filters,
      error: errorObj.message,
      stack: errorObj.stack,
      name: errorObj.name,
    })
    throw new Error('견적서 검색에 실패했습니다')
  }
}

/**
 * 견적서 client_name을 집계해 클라이언트 요약 목록 생성 (캐시 미적용 원본)
 * 항목(items) 조회를 생략해 N+1을 피하고 상위 속성만 읽는다.
 */
async function getClientsUncached(): Promise<ClientSummary[]> {
  try {
    const dataSourceId = await getDataSourceId()
    const summaryMap = new Map<string, ClientSummary>()
    let cursor: string | undefined = undefined

    do {
      const response = await notion.dataSources.query({
        data_source_id: dataSourceId,
        page_size: 100,
        start_cursor: cursor || undefined,
      })

      response.results
        .filter((page): page is NotionPage => 'properties' in page)
        .filter(isInvoicePage)
        .forEach(page => {
          const props = page.properties
          const name =
            props.client_name?.rich_text?.map(t => t.plain_text).join('') ||
            '미지정'
          const businessNumber =
            props.business_number?.rich_text?.map(t => t.plain_text).join('') ||
            ''
          const amount = props.total_amount?.number || 0
          const issueDate = props.issue_date?.date?.start || ''

          const existing = summaryMap.get(name)
          if (existing) {
            existing.invoiceCount += 1
            existing.totalAmount += amount
            if (businessNumber && !existing.businessNumber) {
              existing.businessNumber = businessNumber
            }
            if (issueDate > existing.lastIssueDate) {
              existing.lastIssueDate = issueDate
            }
          } else {
            summaryMap.set(name, {
              name,
              businessNumber,
              invoiceCount: 1,
              totalAmount: amount,
              lastIssueDate: issueDate,
            })
          }
        })

      cursor = response.has_more ? response.next_cursor || undefined : undefined
    } while (cursor)

    const clients = Array.from(summaryMap.values()).sort((a, b) =>
      b.lastIssueDate.localeCompare(a.lastIssueDate)
    )

    logger.info('클라이언트 집계 성공', { count: clients.length })
    return clients
  } catch (error) {
    const errorObj = error as Error
    logger.error('클라이언트 집계 실패', { error: errorObj.message })
    throw new Error('클라이언트 목록을 불러올 수 없습니다')
  }
}

/**
 * 클라이언트 요약 목록 조회 (60초 캐시, 'invoice' 태그로 견적서 변경 시 함께 무효화)
 */
export const getClients = unstable_cache(getClientsUncached, ['clients'], {
  revalidate: 60,
  tags: ['invoice'],
})

/**
 * 견적서 변경 후 관련 캐시 무효화
 * unstable_cache 태그('invoice')와 관련 라우트 경로를 함께 무효화한다.
 * @param invoiceId - 변경된 견적서 ID (상세 페이지 무효화용, 선택)
 */
function revalidateInvoiceCaches(invoiceId?: string): void {
  revalidateTag('invoice')
  revalidatePath('/admin/invoices')
  revalidatePath('/admin/clients')
  revalidatePath('/admin')
  if (invoiceId) {
    revalidatePath(`/invoice/${invoiceId}`)
  }
}

/**
 * 견적서 상위 속성 수정 (Notion pages.update)
 * @param pageId - 견적서 페이지 ID
 * @param data - 수정할 Invoice 부분 데이터 (제공된 필드만 반영)
 * @throws Error - 수정 실패 시
 */
export async function updateInvoice(
  pageId: string,
  data: Partial<Invoice>
): Promise<void> {
  try {
    await withRetry(() =>
      notion.pages.update({
        page_id: pageId,
        properties: buildInvoicePropertiesPayload(data),
      })
    )
    revalidateInvoiceCaches(pageId)
    logger.info('견적서 수정 성공', { pageId })
  } catch (error) {
    const errorObj = error as Error
    logger.error('견적서 수정 실패', { pageId, error: errorObj.message })
    throw new Error(ERROR_MESSAGES.INVOICE_UPDATE_ERROR)
  }
}

/**
 * 견적 항목 신규 생성
 * 항목은 견적서와 별개 Notion DB이므로 NOTION_ITEMS_DATABASE_ID 설정이 필요하다.
 * @param invoiceId - 연결할 견적서 페이지 ID
 * @param item - 생성할 항목 데이터 (id 제외)
 * @throws Error - 항목 DB 미설정 또는 생성 실패 시
 */
export async function createInvoiceItem(
  invoiceId: string,
  item: Omit<InvoiceItem, 'id'>
): Promise<void> {
  const itemsDatabaseId = env.NOTION_ITEMS_DATABASE_ID
  if (!itemsDatabaseId) {
    throw new Error(ERROR_MESSAGES.ITEMS_DB_NOT_CONFIGURED)
  }
  try {
    const dataSourceId = await getDataSourceId(itemsDatabaseId)
    const createParams = {
      parent: { type: 'data_source_id', data_source_id: dataSourceId },
      properties: buildItemPropertiesPayload(item, invoiceId),
    }
    // Notion API v5의 data_source_id 부모 생성 (SDK 타입 버전차 보정)
    await withRetry(() =>
      notion.pages.create(createParams as unknown as CreatePageParameters)
    )
    revalidateInvoiceCaches(invoiceId)
    logger.info('견적 항목 생성 성공', { invoiceId })
  } catch (error) {
    const errorObj = error as Error
    logger.error('견적 항목 생성 실패', { invoiceId, error: errorObj.message })
    if (errorObj.message === ERROR_MESSAGES.ITEMS_DB_NOT_CONFIGURED) {
      throw error
    }
    throw new Error(ERROR_MESSAGES.ITEM_UPDATE_ERROR)
  }
}

/**
 * 견적 항목 수정 (Notion pages.update)
 * @param itemId - 항목 페이지 ID
 * @param item - 수정할 항목 부분 데이터
 * @param invoiceId - 소속 견적서 ID (캐시 무효화용, 선택)
 * @throws Error - 수정 실패 시
 */
export async function updateInvoiceItem(
  itemId: string,
  item: Partial<Omit<InvoiceItem, 'id'>>,
  invoiceId?: string
): Promise<void> {
  try {
    await withRetry(() =>
      notion.pages.update({
        page_id: itemId,
        properties: buildItemPropertiesPayload(item),
      })
    )
    revalidateInvoiceCaches(invoiceId)
    logger.info('견적 항목 수정 성공', { itemId })
  } catch (error) {
    const errorObj = error as Error
    logger.error('견적 항목 수정 실패', { itemId, error: errorObj.message })
    throw new Error(ERROR_MESSAGES.ITEM_UPDATE_ERROR)
  }
}

/**
 * 견적 항목 삭제 (Notion 아카이브 처리)
 * @param itemId - 항목 페이지 ID
 * @param invoiceId - 소속 견적서 ID (캐시 무효화용, 선택)
 * @throws Error - 삭제 실패 시
 */
export async function archiveInvoiceItem(
  itemId: string,
  invoiceId?: string
): Promise<void> {
  try {
    await withRetry(() =>
      notion.pages.update({ page_id: itemId, archived: true })
    )
    revalidateInvoiceCaches(invoiceId)
    logger.info('견적 항목 삭제 성공', { itemId })
  } catch (error) {
    const errorObj = error as Error
    logger.error('견적 항목 삭제 실패', { itemId, error: errorObj.message })
    throw new Error(ERROR_MESSAGES.ITEM_UPDATE_ERROR)
  }
}
