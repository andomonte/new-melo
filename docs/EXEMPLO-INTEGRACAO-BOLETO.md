# 🎫 Exemplo de Integração: Boleto no Faturamento

## Como Adicionar Botão de Boleto no FaturamentoNota.tsx

### 1. Importar o Componente

```tsx
import { GerarBoletoButton } from '@/components/boleto/GerarBoletoButton';
```

### 2. Adicionar o Botão na Interface

```tsx
// Dentro do componente FaturamentoNota
// Após a seção de cobrança ou no rodapé do modal

<div className="mt-6 border-t pt-4">
  <h3 className="text-lg font-semibold mb-3">Gerar Boleto Bancário</h3>
  
  <div className="flex gap-4">
    {/* Botão Gerar Boleto */}
    <GerarBoletoButton
      codfat={dadosFatura?.codfat || ''}
      valor={parseFloat(dadosFatura?.vlrtotal || '0')}
      vencimento={calcularVencimento(30)} // 30 dias
      banco="0" // 0=Bradesco, 1=BB, 2=Itaú
      descricao={`Fatura ${dadosFatura?.codfat} - Cliente ${dadosCliente?.nome}`}
      onSucesso={(boleto) => {
        console.log('Boleto gerado com sucesso!', boleto);
        toast.success('Boleto gerado com sucesso!');
        
        // Opcional: Atualizar estado ou recarregar dados
        // refetchFatura();
      }}
      className="flex-1"
    />
    
    {/* Outros botões podem ficar aqui */}
  </div>
  
  <div className="mt-2 text-sm text-gray-600">
    <p>💡 O boleto será gerado com vencimento em 30 dias</p>
    <p>📄 Você poderá visualizar e imprimir após a geração</p>
  </div>
</div>
```

### 3. Funções Auxiliares

```tsx
// Calcular data de vencimento
const calcularVencimento = (dias: number): string => {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString().split('T')[0]; // YYYY-MM-DD
};

// Determinar banco do cliente
const getBancoCliente = (): '0' | '1' | '2' => {
  const bancoCodigo = dadosCliente?.banco_codigo || '0';
  return bancoCodigo as '0' | '1' | '2';
};
```

### 4. Exemplo Completo no Modal

```tsx
export default function FaturamentoNota({ isOpen, onClose, vendas }: ModalProps) {
  const [dadosFatura, setDadosFatura] = useState<any>(null);
  const [dadosCliente, setDadosCliente] = useState<any>(null);
  
  // ... resto do código
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        {/* Informações da Fatura */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold">
            Fatura #{dadosFatura?.codfat}
          </h2>
          <p className="text-gray-600">
            Cliente: {dadosCliente?.nome}
          </p>
        </div>
        
        {/* Itens da Fatura */}
        <div className="mb-6">
          {/* ... tabela de itens ... */}
        </div>
        
        {/* Totais */}
        <div className="mb-6 border-t pt-4">
          <div className="flex justify-between text-xl font-bold">
            <span>Total:</span>
            <span>R$ {formatarMoeda(dadosFatura?.vlrtotal)}</span>
          </div>
        </div>
        
        {/* SEÇÃO DE BOLETO */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Boleto Bancário
          </h3>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800">
              <strong>ℹ️ Informação:</strong> Gere um boleto bancário para esta fatura. 
              O cliente poderá pagar em qualquer banco ou lotérica.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Bradesco */}
            <GerarBoletoButton
              codfat={dadosFatura?.codfat || ''}
              valor={parseFloat(dadosFatura?.vlrtotal || '0')}
              vencimento={calcularVencimento(30)}
              banco="0"
              descricao={`Fatura ${dadosFatura?.codfat}`}
              onSucesso={(boleto) => {
                toast.success('Boleto Bradesco gerado!');
              }}
            >
              <span className="flex items-center">
                <span className="mr-2">🏦</span>
                Boleto Bradesco
              </span>
            </GerarBoletoButton>
            
            {/* Banco do Brasil */}
            <GerarBoletoButton
              codfat={dadosFatura?.codfat || ''}
              valor={parseFloat(dadosFatura?.vlrtotal || '0')}
              vencimento={calcularVencimento(30)}
              banco="1"
              descricao={`Fatura ${dadosFatura?.codfat}`}
              onSucesso={(boleto) => {
                toast.success('Boleto Banco do Brasil gerado!');
              }}
            >
              <span className="flex items-center">
                <span className="mr-2">🏦</span>
                Boleto Banco do Brasil
              </span>
            </GerarBoletoButton>
            
            {/* Itaú */}
            <GerarBoletoButton
              codfat={dadosFatura?.codfat || ''}
              valor={parseFloat(dadosFatura?.vlrtotal || '0')}
              vencimento={calcularVencimento(30)}
              banco="2"
              descricao={`Fatura ${dadosFatura?.codfat}`}
              onSucesso={(boleto) => {
                toast.success('Boleto Itaú gerado!');
              }}
              className="col-span-2"
            >
              <span className="flex items-center">
                <span className="mr-2">🏦</span>
                Boleto Itaú
              </span>
            </GerarBoletoButton>
          </div>
        </div>
        
        {/* Botões de Ação */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

## 5. Versão Simplificada (Automática)

```tsx
// Gera boleto automaticamente usando banco preferencial do cliente

<GerarBoletoButton
  codfat={dadosFatura?.codfat || ''}
  // valor e vencimento são opcionais - serão buscados da fatura
  onSucesso={(boleto) => {
    console.log('Boleto gerado:', boleto);
  }}
/>
```

## 6. Com Seletor de Banco

```tsx
const [bancoSelecionado, setBancoSelecionado] = useState<'0' | '1' | '2'>('0');

<div>
  <label className="block text-sm font-medium mb-2">
    Selecione o Banco:
  </label>
  
  <select
    value={bancoSelecionado}
    onChange={(e) => setBancoSelecionado(e.target.value as '0' | '1' | '2')}
    className="w-full p-2 border rounded-lg mb-4"
  >
    <option value="0">Bradesco (237)</option>
    <option value="1">Banco do Brasil (001)</option>
    <option value="2">Itaú (341)</option>
  </select>
  
  <GerarBoletoButton
    codfat={dadosFatura?.codfat || ''}
    banco={bancoSelecionado}
  />
</div>
```

## 7. Com Data de Vencimento Customizável

```tsx
const [diasVencimento, setDiasVencimento] = useState(30);

<div>
  <label className="block text-sm font-medium mb-2">
    Vencimento em:
  </label>
  
  <div className="flex gap-2 mb-4">
    <button
      onClick={() => setDiasVencimento(15)}
      className={`px-4 py-2 rounded ${diasVencimento === 15 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
    >
      15 dias
    </button>
    <button
      onClick={() => setDiasVencimento(30)}
      className={`px-4 py-2 rounded ${diasVencimento === 30 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
    >
      30 dias
    </button>
    <button
      onClick={() => setDiasVencimento(60)}
      className={`px-4 py-2 rounded ${diasVencimento === 60 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
    >
      60 dias
    </button>
  </div>
  
  <GerarBoletoButton
    codfat={dadosFatura?.codfat || ''}
    vencimento={calcularVencimento(diasVencimento)}
  />
</div>
```

## 8. Na Lista de Faturas

```tsx
// Em uma tabela de faturas

<table>
  <tbody>
    {faturas.map((fatura) => (
      <tr key={fatura.codfat}>
        <td>{fatura.codfat}</td>
        <td>{fatura.cliente}</td>
        <td>R$ {formatarMoeda(fatura.valor)}</td>
        <td>
          <GerarBoletoButton
            codfat={fatura.codfat}
            className="text-sm px-3 py-1"
          >
            <span>🎫 Boleto</span>
          </GerarBoletoButton>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

## 9. Callbacks Avançados

```tsx
<GerarBoletoButton
  codfat={dadosFatura?.codfat || ''}
  onSucesso={(boleto) => {
    // 1. Exibir notificação
    toast.success('Boleto gerado com sucesso!', {
      description: `Nosso Número: ${boleto.nossoNumero}`,
    });
    
    // 2. Copiar linha digitável
    navigator.clipboard.writeText(boleto.linhaDigitavel);
    
    // 3. Enviar por email
    enviarBoletoEmail(boleto);
    
    // 4. Atualizar estado
    setBoletosGerados([...boletosGerados, boleto]);
    
    // 5. Fechar modal
    onClose();
  }}
/>
```

## 10. Validações Antes de Gerar

```tsx
const handleGerarBoleto = () => {
  // Validar se fatura está paga
  if (dadosFatura?.status === 'PAGO') {
    toast.error('Fatura já está paga!');
    return;
  }
  
  // Validar se já existe boleto
  if (dadosFatura?.codigo_barras) {
    const confirmar = window.confirm(
      'Já existe um boleto para esta fatura. Deseja gerar um novo?'
    );
    if (!confirmar) return;
  }
  
  // Validar valor mínimo
  if (parseFloat(dadosFatura?.vlrtotal || '0') < 10) {
    toast.error('Valor mínimo para boleto é R$ 10,00');
    return;
  }
  
  // Continuar com geração...
};

<button onClick={handleGerarBoleto}>
  Gerar Boleto
</button>
```

## ✅ Checklist de Integração

- [ ] Importar `GerarBoletoButton`
- [ ] Adicionar botão na interface
- [ ] Testar geração de boleto
- [ ] Verificar visualização do boleto
- [ ] Testar impressão
- [ ] Validar linha digitável
- [ ] Verificar salvamento no banco
- [ ] Testar com diferentes bancos
- [ ] Adicionar tratamento de erros
- [ ] Documentar para o time
