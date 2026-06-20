/**
 * Notion API 응답 타입 정의
 * @notionhq/client SDK 공식 타입을 재사용하여 중복 방지
 */

import type {
  PageObjectResponse,
  DatabaseObjectResponse,
} from '@notionhq/client/build/src/api-endpoints'

/**
 * Notion Page 타입 (SDK 재사용)
 */
export type NotionPage = PageObjectResponse

/**
 * Notion Database 타입 (SDK 재사용)
 */
export type NotionDatabase = DatabaseObjectResponse

/**
 * 견적서 페이지 속성 타입
 * CSV 데이터의 실제 한글 속성명을 반영
 */
export interface InvoicePageProperties {
  /** 견적서 번호 (Title 속성) */
  invoice_number: {
    type: 'title'
    title: Array<{ plain_text: string }>
  }
  /** 클라이언트명 (Rich Text 속성) */
  client_name: {
    type: 'rich_text'
    rich_text: Array<{ plain_text: string }>
  }
  /** 사업자번호 (Rich Text 속성, 고객 본인확인용) */
  business_number?: {
    type: 'rich_text'
    rich_text: Array<{ plain_text: string }>
  }
  /** 발행일 (Date 속성) */
  issue_date: {
    type: 'date'
    date: { start: string } | null
  }
  /** 유효기간 (Date 속성) */
  valid_until: {
    type: 'date'
    date: { start: string } | null
  }
  /** 총 금액 (Number 속성) */
  total_amount: {
    type: 'number'
    number: number | null
  }
  /** 상태 (Select 속성: pending/approved/rejected) */
  status: {
    type: 'select'
    select: { name: string } | null
  }
  /** 항목 (Relation 속성 → items DB) */
  items: {
    type: 'relation'
    relation: Array<{ id: string }>
  }
}

/**
 * 항목 페이지 속성 타입
 * CSV 데이터의 Items 테이블 구조를 반영
 */
export interface ItemPageProperties {
  /** 항목명 (Title 속성) */
  item_name: {
    type: 'title'
    title: Array<{ plain_text: string }>
  }
  /** 수량 (Number 속성) */
  quantity: {
    type: 'number'
    number: number | null
  }
  /** 단가 (Number 속성) */
  unit_price: {
    type: 'number'
    number: number | null
  }
  /** 금액 (Number 속성, 비우면 수량×단가로 재계산) */
  amount: {
    type: 'number'
    number: number | null
  }
  /** invoices (Relation 속성 → invoice DB) */
  invoices: {
    type: 'relation'
    relation: Array<{ id: string }>
  }
}

/**
 * Notion 페이지를 Invoice 속성으로 타입 캐스팅하기 위한 타입 가드
 */
export function isInvoicePage(
  page: NotionPage
): page is NotionPage & { properties: InvoicePageProperties } {
  return 'properties' in page && 'invoice_number' in page.properties
}

/**
 * Notion 페이지를 Item 속성으로 타입 캐스팅하기 위한 타입 가드
 */
export function isItemPage(
  page: NotionPage
): page is NotionPage & { properties: ItemPageProperties } {
  return 'properties' in page && 'item_name' in page.properties
}
