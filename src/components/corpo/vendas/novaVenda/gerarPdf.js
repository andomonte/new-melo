import React from 'react';
import JsPDF from 'jspdf';
import MascaraCPF from '@/utils/mascaraCPF';
//import autoTable from 'jspdf-autotable'
//import { font } from "./font";

function Test({ carrinho, setOpenPdf, nPedido, cliente, dadosEmpresa, usuario }) {
  //não delete ainda falta finalizar esse
  console.log('oi dadosEmpresa', dadosEmpresa); 
  const dataAgora = new Date();
  const dia = dataAgora.getDate() > 9 ? dataAgora.getDate() : `0${dataAgora.getDate()}`;
  const mes = dataAgora.getMonth() + 1 > 9 ? dataAgora.getMonth() + 1 : `0${dataAgora.getMonth() + 1}`;
  const dataAtual = `${dia}/${mes}/${dataAgora.getFullYear()}`;

 

  React.useEffect(() => {
    setOpenPdf(false);
    let posicaoV = 0;
    let posicaoH = 0;
//    let posisaoLinha=0
    const doc = new JsPDF();
    //inserir imagem - px,py,w,h
  
    //cabeçalho do orçamento
    //  doc.addImage('/images/formOrcamento.png', 'PNG', 5, 5, 200, 280);
    doc.roundedRect (5, 5, 200, 36, 3, 3, )
    doc.addImage('/images/logoPdf.png', 'PNG', 8, 8, 30, 10);
    doc.setFont('helvetica','bold');
    doc.setFontSize(14);    
    doc.text(`ORÇAMENTO`,85, 15,);
    doc.line(160, 5, 160, 20); //(x1,y1,x2,y2)
    
    doc.setFontSize(8);   
    doc.setTextColor(169,169,169);
    doc.text(`Número`,165, 10,);
    doc.setFontSize(10);   
    doc.setTextColor(0, 0, 0);
    doc.text(`${nPedido}`,163, 16,);
    doc.line(5, 20, 205, 20); //(x1,y1,x2,y2)

    doc.setFontSize(8);
    doc.setTextColor(169,169,169);
    doc.text(`Cliente: `,13,27,);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`${cliente.nome ? cliente.nome?.substring(0,40):'-'}}`, 26, 27,);
    
    doc.setFontSize(8);
    doc.setTextColor(169,169,169);
    if(cliente.documento.length>13) doc.text(`CNPJ:`,154,27,);
    else doc.text(`CPF:`,156,27,);    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`${MascaraCPF(cliente.documento)}`, 164, 27,);
    
    doc.setFontSize(8);
    doc.setTextColor(169,169,169);
    doc.text(`Vendedor: `,10,36,);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`${usuario.NOME ? usuario.NOME.substring(0,40):'-'}`, 26, 36,);
    
    doc.setFontSize(8);
    doc.setTextColor(169,169,169);
    doc.text(`Data: `,155,36,);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`${dataAtual}`, 164, 36,);

    // doc.line(5, 40, 205, 40); //(x1,y1,x2,y2)
    doc.roundedRect(5, 44, 200, 230, 3, 3,)
    
    //cabeçalho da tabela
    doc.line(5, 54, 205, 54); //(x1,y1,x2,y2)
    doc.line(20, 44, 20, 54); //linha na vertical
    doc.line(40, 44, 40, 54); //linha na vertical
    doc.line(140, 44, 140, 54); //linha na vertical
    doc.line(174, 44, 174, 54); //linha na vertical

    doc.setFontSize(10);
    doc.setTextColor(0,0,0);
    doc.text(`Quant`,12.5,50,'center');

    doc.setFontSize(10);
    doc.setTextColor(0,0,0);
    doc.text(`Unid`,30,50,'center');
   
    doc.setFontSize(10);
    doc.setTextColor(0,0,0);
    doc.text(`Item`,90,50,'center');

    doc.setFontSize(10);
    doc.setTextColor(0,0,0);
    doc.text(`Preço`, 157, 50,'center');
    
    doc.setFontSize(10);
    doc.setTextColor(0,0,0);
    doc.text(`Total do Item`,189,50,'center');
    posicaoV = 60;
    let posicaoLinhaH = 54;
   // let posicaoLinhaV1 = 64;
  //  let posicaoLinhaV2 = 64;
  //  let posicaoLinhaV3 = 64;
  //  let posicaoLinhaV4 = 64;
    for (let i = 0; i < carrinho.length; i += 1) { 

      posicaoV = posicaoV + (i * 10);
      posicaoLinhaH = posicaoLinhaH + (i * 10);

      doc.line(40, posicaoH, 40, posicaoH+10); //linha na vertical
      doc.line(140, posicaoH, 140, posicaoH+10); //linha na vertical
      doc.line(174, posicaoH, 174, posicaoH+10); //linha na vertical
  
      doc.setFontSize(10);
      doc.setTextColor(0,0,0);
      doc.text(`${carrinho[i].quantidade}`,12.5,posicaoV,'center');
  
      doc.setFontSize(10);
      doc.setTextColor(0,0,0);
      doc.text(`pç`,30,posicaoV,'center');
     
      doc.setFontSize(10);
      doc.setTextColor(0,0,0);
      doc.text(`${carrinho[i].descriçãoEditada}`,90,posicaoV,'center');
  
      doc.setFontSize(10);
      doc.setTextColor(0,0,0);
      doc.text(`${carrinho[i].precoItemEditado
      }`, 157, posicaoV,'center');
      
      doc.setFontSize(10);
      doc.setTextColor(0,0,0);
      doc.text(`${carrinho[i].totalItem
      }`,189,posicaoV,'center');
    }
    
/*     doc.setFontSize(8);
    doc.setTextColor(169,169,169);
    doc.text(`Cliente: `,13,46,);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`${cliente.nome?.substring(0,40)}`, 26, 46,);
    
    
    doc.setFontSize(8);
    doc.setTextColor(169,169,169);
    doc.text(`Telefone: `, 149, 46,);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`${dadosEmpresa.FONE ? dadosEmpresa.FONE: '-'}`, 164, 46,);
    
    doc.setFontSize(8);
    doc.setTextColor(169,169,169);
    doc.text(`Endereço: `,10,55,);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`${cliente.ENDER ? cliente.ENDER?.substring(0,40):"-"}`, 26, 55,);
        
    doc.setFontSize(8);
    doc.setTextColor(169,169,169);
    doc.text(`Cep: `, 155, 55,);
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`${cliente.CEP ? cliente.CEP: '-'}`, 164, 55,);
 */

    //travar (limitar) caracter = .substring(0,300)
   // let contLinha = 1;
    //inserir tabela
    
    /* autoTable(doc, {
      columnStyles: { item: { halign: 'start' } }, // European countries centered
      margin: { top: 20, left: 4, right: 4 },
      body: [
        { item: 'Sweden', qdt: 'Canada', precoItem: 'China',totalItem: 'China' },
       
      ],
      columns: [
        { header: 'Item', dataKey: 'item' },
        { header: 'Qdt', dataKey: 'qdt' },
        { header: 'Preço Item', dataKey: 'precoItem' },
        { header: 'Total Item', dataKey: 'totalItem' },
      ],
    })
    autoTable(doc, {
      columnStyles: { item: { halign: 'start' } }, // European countries centered
      margin: { top: 20, left: 4, right: 4 },
      body: [
        { item: 'Sweden', qdt: 'Canada', precoItem: 'China',totalItem: 'China' },
       
      ],
      columns: [
        { header: 'Item', dataKey: 'item' },
        { header: 'Qdt', dataKey: 'qdt' },
        { header: 'Preço Item', dataKey: 'precoItem' },
        { header: 'Total Item', dataKey: 'totalItem' },
      ],
    }) */
    //inserir linhas
    

    /* for (let i = 0; i < carrinho.length; i += 1) {
      posicaoV = contLinha * 22;
      posicaoH = 5;
      contLinha += 1;

      doc.setFontSize(8);
      doc.addFileToVFS("WorkSans-normal.ttf", font);
      doc.addFont("WorkSans-normal.ttf", "WorkSans", "bold");
      doc.setFont("WorkSans");
      doc.setTextColor('#000');
      doc.text(posicaoH, posicaoV, `Item`);
      doc.setTextColor(100);
      doc.text(
        10,
        Number(posicaoV + 6),
        `aqui começo`,
      );
      if (carrinho[i].valor) {
        doc.setTextColor(0, 0, 255);
        doc.addFileToVFS("WorkSans-normal.ttf", font);
        doc.addFont("WorkSans-normal.ttf", "WorkSans", "normal");
        doc.setFont("WorkSans");
        doc.text(10, Number(posicaoV + 12), `FEZ RELATÓRIO ANUAL`);
      } else {
        doc.setTextColor(255, 0, 0);
        doc.setFont('Fugaz One');
        doc.text(10, Number(posicaoV + 12), `NÃO FEZ RELATÓRIO ANUAL`);
      }
      if (posicaoV > 240) {
        doc.addPage();
        posicaoV = 12;
        contLinha = 1;
      }
    } */
    doc.save('a4.pdf'); // will save the file in the current working directory
  
  }, [setOpenPdf,carrinho,nPedido,cliente,dataAtual,usuario]);
  return '';
}

export default Test;