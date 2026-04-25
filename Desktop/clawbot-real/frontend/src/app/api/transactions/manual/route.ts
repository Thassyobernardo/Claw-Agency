
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { z } from "zod";

/**
 * Esquema de validacao para transacoes manuais
 */
const TransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(3).max(255),
  amount: z.coerce.number().positive(),
});

const RequestSchema = z.array(TransactionSchema);

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar sessao
    const session = await getServerSession(authOptions);
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = session.user.companyId;

    // 2. Parsear e validar corpo
    const body = await request.json();
    const result = RequestSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: "Invalid data", details: result.error.format() }, { status: 400 });
    }

    const transactions = result.data;

    // 3. Inserir no banco de dados
    const insertedCount = await sql.begin(async (tx) => {
      let count = 0;
      for (const tx_data of transactions) {
        await tx`
          INSERT INTO transactions (
            company_id,
            source,
            transaction_date,
            description,
            amount_aud,
            classification_status
          ) VALUES (
            ${companyId}::uuid,
            'manual',
            ${tx_data.date},
            ${tx_data.description},
            ${tx_data.amount},
            'pending'
          )
        `;
        count++;
      }
      return count;
    });

    // 4. Trigger IA (Opcional: chamar o backend de IA em background aqui)
    // fetch(`${process.env.INTERNAL_API_URL}/classify`, { ... })

    return NextResponse.json({ 
      success: true, 
      message: `${insertedCount} transactions saved successfully.`,
      count: insertedCount 
    }, { status: 201 });

  } catch (error: any) {
    console.error("[manual_transactions] Error:", error.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
