import Link from 'next/link'
import { FileText } from 'lucide-react'
import { Footer } from '@/components/layout/footer'
import { LookupForm } from './_components/lookup-form'

/**
 * 고객 랜딩 페이지
 * 사명 + 사업자번호로 본인 견적서를 조회할 수 있는 공개 진입점
 */
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <div className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-xl">
            <div className="mb-8 text-center">
              <h1 className="mb-3 text-4xl font-bold">견적서 조회</h1>
              <p className="text-muted-foreground text-lg">
                사명과 사업자번호를 입력하면 발행된 견적서를 확인할 수 있습니다
              </p>
            </div>

            <LookupForm />

            <div className="mt-8 text-center">
              <Link
                href="/invoice/guide"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                <FileText className="h-4 w-4" />
                견적서 조회 방법 안내
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
