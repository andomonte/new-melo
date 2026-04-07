import { readFileSync } from 'fs';
import puppeteer from 'puppeteer';
import path from 'path';
import { Buffer } from 'buffer';

// Use uma interface para garantir que os dados passados para a função estejam corretos.
// Esta interface deve corresponder aos placeholders {{...}} do seu HTML.
interface DanfeData {
    emitente: { nome: string; razaoSocial: string; endereco: string; cnpj: string; ie: string; cidade: string; uf: string; cep: string; telefone: string; fax: string; };
    destinatario: { nome: string; cpfCnpj: string; endereco: string; bairro: string; cep: string; cidade: string; uf: string; telefone: string; };
    info: { numero: string; serie: string; urlConsulta: string; chaveAcesso: string; protocolo: string; naturezaOperacao: string; dataEmissao: string; dataSaida: string; infoComplementar: string; };
    fatura: { prazo: string; formaPagamento: string; valor: string; };
    totais: { tributos: string; desconto: string; valorProdutos: string; valorNota: string; };
    produtos: Array<{
        codigo: string;
        descricao: string;
        ncm: string;
        cst: string;
        cfop: string;
        unidade: string;
        quantidade: string;
        valorUnitario: string;
        valorTotal: string;
        baseIcms: string;
        valorIcms: string;
        baseIpi: string;
        valorIpi: string;
        aliqIcms: string;
        aliqIpi: string;
    }>;
    qrCodeImageBase64: string;
}

/**
 * Gera um DANFE em PDF a partir de um template HTML e dados dinâmicos.
 * @returns Um Buffer com os bytes do arquivo PDF gerado.
 */
export default async function gerarDanfePDF(): Promise<Buffer> {
    // ✅ DADOS VAZIOS (MOCK) PARA VISUALIZAR O TEMPLATE
    // Para usar com dados dinâmicos, remova este objeto e receba 'dados: DanfeData' como parâmetro da função.
    const dados: DanfeData = {
        emitente: { nome: '', razaoSocial: '', endereco: '', cnpj: '', ie: '', cidade: '', uf: '', cep: '', telefone: '', fax: '' },
        destinatario: { nome: '', cpfCnpj: '', endereco: '', bairro: '', cep: '', cidade: '', uf: '', telefone: '' },
        info: { numero: '', serie: '', urlConsulta: '', chaveAcesso: '', protocolo: '', naturezaOperacao: '', dataEmissao: '', dataSaida: '', infoComplementar: '' },
        fatura: { prazo: '', formaPagamento: '', valor: '' },
        totais: { tributos: '', desconto: '', valorProdutos: '', valorNota: '' },
        produtos: [], // Array vazio para não gerar linhas de produto
        qrCodeImageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', // Placeholder 1x1 pixel transparente
    };

    // 1. Carregar o template HTML do arquivo local.
    const templatePath = path.resolve('./src/components/template/danfe.html'); // <-- VERIFIQUE SE ESTE CAMINHO ESTÁ CORRETO
    let htmlTemplate = readFileSync(templatePath, 'utf-8');

    // 2. Substituir os placeholders no HTML.
    
    let produtosHtml = '';
    
    const produtos = Array.isArray(dados.produtos) ? dados.produtos : [];

    for (const produto of produtos) {
        produtosHtml += `
            <tr style="font-size: 8pt;">
                <td class="text-center">${produto.codigo || ''}</td>
                <td>${produto.descricao || ''}</td>
                <td class="text-center">${produto.ncm || ''}</td>
                <td class="text-center">${produto.cst || ''}</td>
                <td class="text-center">${produto.cfop || ''}</td>
                <td class="text-center">${produto.unidade || ''}</td>
                <td class="text-right">${produto.quantidade || ''}</td>
                <td class="text-right">${produto.valorUnitario || ''}</td>
                <td class="text-right">${produto.valorTotal || ''}</td>
                <td class="text-right">${produto.baseIcms || ''}</td>
                <td class="text-right">${produto.valorIcms || ''}</td>
                <td class="text-right">${produto.baseIpi || ''}</td>
                <td class="text-right">${produto.valorIpi || ''}</td>
                <td class="text-right">${produto.aliqIcms || ''}</td>
                <td class="text-right">${produto.aliqIpi || ''}</td>
            </tr>
        `;
    }
    
    // Substitui o marcador do loop de produtos pelo HTML gerado
    htmlTemplate = htmlTemplate.replace('{{#each produtos}}{{/each}}', produtosHtml);

    // Substitui os outros placeholders. Adicione todos os seus campos aqui.
    // Usar uma função de substituição para lidar com campos potencialmente nulos de forma segura.
    const preencher = (template: string, dados: object) => {
        return template.replace(/{{(.*?)}}/g, (match, p1) => {
            const keys = p1.split('.');
            let value: any = dados;
            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    return ''; // Retorna string vazia se o caminho não for encontrado
                }
            }
            return value ?? ''; // Retorna string vazia se o valor final for null/undefined
        });
    };

    htmlTemplate = preencher(htmlTemplate, dados);


    // 3. Iniciar o Puppeteer para criar o PDF
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Argumentos importantes para rodar em servidores
    });
    const page = await browser.newPage();

    // 4. Carregar o HTML finalizado na página do navegador invisível
    await page.setContent(htmlTemplate, { waitUntil: 'domcontentloaded' });

    // 5. Gerar o PDF
    const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
            top: '0mm',
            right: '0mm',
            bottom: '0mm',
            left: '0mm'
        }
    });

    // 6. Fechar o navegador para liberar recursos
    await browser.close();

    // A função page.pdf() retorna um tipo que pode ser interpretado como Uint8Array.
    // Para garantir a compatibilidade com o tipo de retorno 'Buffer' da função,
    // criamos explicitamente um Buffer a partir do resultado para resolver o erro de tipo.
    return Buffer.from(pdfBuffer);
}
