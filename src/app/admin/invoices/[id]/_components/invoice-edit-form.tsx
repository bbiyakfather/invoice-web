'use client'

/**
 * 견적서 편집 폼 (React Hook Form + Zod)
 * 상위 속성 + 항목(useFieldArray) 수정/추가/삭제를 한 폼에서 처리한다.
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus, Trash2, Save } from 'lucide-react'

import {
  invoiceEditSchema,
  type InvoiceEditInput,
} from '@/lib/validations/invoice'
import { updateInvoiceAction } from '../actions'
import type { Invoice } from '@/types/invoice'
import { INVOICE_STATUS_LABELS } from '@/lib/constants'
import { formatCurrency } from '@/lib/format'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { InvoiceStatus } from '@/types/invoice'

const STATUS_OPTIONS: InvoiceStatus[] = ['pending', 'approved', 'rejected']

export function InvoiceEditForm({ invoice }: { invoice: Invoice }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<InvoiceEditInput>({
    resolver: zodResolver(invoiceEditSchema),
    defaultValues: {
      clientName: invoice.clientName,
      businessNumber: invoice.businessNumber,
      issueDate: invoice.issueDate,
      validUntil: invoice.validUntil,
      status: invoice.status,
      totalAmount: invoice.totalAmount,
      items: invoice.items.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      })),
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  // 항목 변경 시 합계 실시간 표시
  const watchedItems = form.watch('items')
  const computedTotal = watchedItems.reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  )

  function onSubmit(values: InvoiceEditInput) {
    // 항목 금액·총액은 수량×단가 기준으로 재계산해 일관성 보장
    const items = values.items.map(item => ({
      ...item,
      amount: item.quantity * item.unitPrice,
    }))
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0)
    const payload: InvoiceEditInput = { ...values, items, totalAmount }

    startTransition(async () => {
      const result = await updateInvoiceAction(invoice.id, payload)
      if (result.success) {
        toast.success('견적서가 저장되었습니다')
        router.refresh()
      } else {
        toast.error(result.error ?? '저장에 실패했습니다')
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 기본 정보 */}
        <Card>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="clientName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>클라이언트명</FormLabel>
                  <FormControl>
                    <Input placeholder="예: ABC 주식회사" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="businessNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>사업자번호</FormLabel>
                  <FormControl>
                    <Input placeholder="예: 123-45-67890" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="issueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>발행일</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="validUntil"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>유효기간</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>상태</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STATUS_OPTIONS.map(status => (
                        <SelectItem key={status} value={status}>
                          {INVOICE_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 견적 항목 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>견적 항목</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  description: '',
                  quantity: 1,
                  unitPrice: 0,
                  amount: 0,
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              항목 추가
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.length === 0 && (
              <p className="text-muted-foreground text-sm">
                항목이 없습니다. &apos;항목 추가&apos;로 추가하세요.
              </p>
            )}
            {fields.map((fieldItem, index) => (
              <div
                key={fieldItem.id}
                className="grid grid-cols-1 items-end gap-3 border-b pb-4 md:grid-cols-[1fr_100px_140px_auto]"
              >
                <FormField
                  control={form.control}
                  name={`items.${index}.description`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>항목명</FormLabel>
                      <FormControl>
                        <Input placeholder="예: 웹사이트 디자인" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`items.${index}.quantity`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>수량</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          onChange={e =>
                            field.onChange(e.target.valueAsNumber || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`items.${index}.unitPrice`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>단가</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          onChange={e =>
                            field.onChange(e.target.valueAsNumber || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  aria-label="항목 삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <div className="flex justify-end pt-2 text-lg font-semibold">
              합계: {formatCurrency(computedTotal)}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={isPending}>
            <Save className="mr-2 h-4 w-4" />
            {isPending ? '저장 중...' : '저장'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
