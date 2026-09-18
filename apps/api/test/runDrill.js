const payload = {
  event: {
    type: 'payout.paid',
    created: 1726500000,
    data: {
      object: {
        id: 'po_live_simulation_002',
        amount: 31325,
        currency: 'usd',
        arrival_date: 1726500000,
        status: 'paid',
        description: 'STRIPE PAYOUT BATCH - DTC BRAND'
      }
    }
  },
  shopifyOrders: [
    {
      id: 1001,
      name: '#1001',
      total_price: '164.50',
      subtotal_price: '140.00',
      total_tax: '14.50',
      shipping_lines: [{ title: 'Standard Ground', price: '10.00' }],
      tax_lines: [{ title: 'California State Sales Tax', price: '14.50', rate: 0.0725 }]
    },
    {
      id: 1002,
      name: '#1002',
      total_price: '170.75',
      subtotal_price: '160.00',
      total_tax: '8.75',
      shipping_lines: [{ title: 'Priority Courier', price: '2.00' }],
      tax_lines: [{ title: 'New York State Tax', price: '8.75', rate: 0.08875 }]
    }
  ],
  directTransactions: [
    {
      id: 'dp_9901',
      type: 'DISPUTE_FEE',
      amount: 1500,
      netAmount: -1500,
      description: 'Stripe dispute chargeback fee'
    }
  ]
};

async function run() {
  console.log('Sending simulation payload to http://localhost:8787/api/webhooks/simulate-settlement...');
  const res = await fetch('http://localhost:8787/api/webhooks/simulate-settlement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  console.log('\n--- SIMULATION RESPONSE ---');
  console.log('Status:', data.status);
  console.log('Math Verified:', data.isMathVerified);
  console.log('Delta:', data.mathSummary?.delta);
  console.log('Total Debits:', data.mathSummary?.totalDebits);
  console.log('Total Credits:', data.mathSummary?.totalCredits);
  console.log('Tables Updated in Supabase:', data.persistence?.tablesUpdated);
  console.log('Journal Lines Count:', data.deconstructedLines?.length);
}

run().catch(console.error);
