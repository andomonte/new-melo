import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  static async getInitialProps(ctx: any) {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps };
  }

  render() {
    return (
      <Html>
        <Head />
        <body>
          {/* Aplica a escala salva ANTES da pintura, senão a tela renderiza no
              padrão e "salta" quando o hook roda (flash). */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var v=localStorage.getItem('sysmelo:ui-scale');if(v)document.documentElement.style.setProperty('--ui-scale',v+'%')}catch(e){}})()`,
            }}
          />
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
