
import fetch from 'node-fetch';

async function testApi() {
    try {
        const response = await fetch('http://localhost:3000/api/contas-pagar/internacionais');

        if (!response.ok) {
            console.error('API Error:', response.status, response.statusText);
            const text = await response.text();
            console.error(text);
            return;
        }

        const data = await response.json();
        console.log('--- API Response Summary ---');
        console.log('Total items:', data.paginacao.total);
        console.log('Items in current page:', data.contas_pagar.length);

        if (data.contas_pagar.length > 0) {
            console.log('Sample item:', JSON.stringify(data.contas_pagar[0], null, 2));

            const nonInternational = data.contas_pagar.filter(i => i.eh_internacional !== 'S');
            if (nonInternational.length > 0) {
                console.error('ERROR: Found non-international items!', nonInternational);
            } else {
                console.log('SUCCESS: All items are international.');
            }
        } else {
            console.log('No items returned (might be expected if no data meets default criteria)');
        }

    } catch (error) {
        console.error('Fetch error:', error);
    }
}

testApi();
