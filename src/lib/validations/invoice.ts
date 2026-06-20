/**
 * 견적서 편집 폼 검증 스키마 (Zod)
 * Server Action 및 React Hook Form(zodResolver)에서 공용으로 사용한다.
 */

import { z } from 'zod'

/**
 * 견적 항목 검증 스키마
 * id는 기존 항목 수정 시 존재, 신규 항목은 없음(생성 대상)
 */
export const itemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, '항목명을 입력하세요'),
  quantity: z.number().min(0, '수량은 0 이상이어야 합니다'),
  unitPrice: z.number().min(0, '단가는 0 이상이어야 합니다'),
  amount: z.number().min(0, '금액은 0 이상이어야 합니다'),
})

/**
 * 견적서 수정 검증 스키마 (상위 속성 + 항목 배열)
 */
export const invoiceEditSchema = z.object({
  clientName: z.string().min(1, '클라이언트명을 입력하세요'),
  businessNumber: z.string(),
  issueDate: z.string().min(1, '발행일을 입력하세요'),
  validUntil: z.string().min(1, '유효기간을 입력하세요'),
  status: z.enum(['pending', 'approved', 'rejected']),
  totalAmount: z.number().min(0, '총액은 0 이상이어야 합니다'),
  items: z.array(itemSchema),
})

/** 견적서 수정 입력 타입 */
export type InvoiceEditInput = z.infer<typeof invoiceEditSchema>
/** 견적 항목 입력 타입 */
export type ItemInput = z.infer<typeof itemSchema>
