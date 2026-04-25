
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
  amount: z.coerce.number().min(0),
  categoryCode: z.string().optional(),
  quantity: z.coerce.number().optional(),
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

    // Buscar categorias para mapeamento se houver entradas detalhadas
    const cats = await sql<{ id: string, code: string, scope: number }[]>`
      SELECT id::text, code, scope FROM emission_categories
    `;
    const catMap = Object.fromEntries(cats.map(c => [c.code, c]));

    // Para calcular co2e precisamos da tabela emission_factors (simplificando usando fatores diretos para categorias)
    // Uma abordagem melhor seria usar a tabela emission_factors completa, mas como fallback para os códigos de categoria:
    const factorMap: Record<string, { factor: number, unit: string }> = {
      'electricity': { factor: 0.79, unit: 'kWh' },
      'fuel_diesel': { factor: 2.68, unit: 'L' },
      'fuel_petrol': { factor: 2.31, unit: 'L' },
      'fuel_lpg': { factor: 1.51, unit: 'L' },
      'natural_gas': { factor: 0.0514, unit: 'MJ' },
      'air_travel': { factor: 0.255, unit: 'km' },
      'road_freight': { factor: 0.113, unit: 'km' },
      'waste': { factor: 467, unit: 'tonne' },
      'water': { factor: 0.344, unit: 'AUD' },
      'accommodation': { factor: 0.198, unit: 'AUD' },
      'meals_entertainment': { factor: 0.262, unit: 'AUD' },
      'it_cloud': { factor: 0.12, unit: 'AUD' },
      'office_supplies': { factor: 0.15, unit: 'AUD' }
    };

    // 3. Inserir no banco de dados
    const insertedCount = await sql.begin(async (tx) => {
      let count = 0;
      for (const tx_data of transactions) {
        
        let status = 'pending';
        let categoryId = null;
        let scope = null;
        let co2eKg = null;
        let qtyVal = null;
        let qtyUnit = null;

        if (tx_data.categoryCode && catMap[tx_data.categoryCode]) {
          const cat = catMap[tx_data.categoryCode];
          categoryId = cat.id;
          scope = cat.scope;
          
          if (tx_data.quantity && factorMap[tx_data.categoryCode]) {
            qtyVal = tx_data.quantity;
            qtyUnit = factorMap[tx_data.categoryCode].unit;
            co2eKg = qtyVal * factorMap[tx_data.categoryCode].factor;
            status = 'classified';
          }
        }

        await tx`
          INSERT INTO transactions (
            company_id,
            source,
            transaction_date,
            description,
            amount_aud,
            category_id,
            scope,
            quantity_value,
            quantity_unit,
            co2e_kg,
            classification_status,
            classified_at
          ) VALUES (
            ${companyId}::uuid,
            'manual',
            ${tx_data.date},
            ${tx_data.description},
            ${tx_data.amount},
            ${categoryId ? sql`${categoryId}::uuid` : null},
            ${scope},
            ${qtyVal},
            ${qtyUnit},
            ${co2eKg},
            ${status},
            ${status === 'classified' ? sql`NOW()` : null}
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
