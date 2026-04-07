//import generatePDF, { Options } from 'react-to-pdf';
import generatePDF, { Margin, Options } from 'react-to-pdf';

import { Button } from '@/components/ui/button';

const options: Options = {
  method: 'open',
  filename: 'using-function.pdf',
  page: {
    // margin is in MM, default is Margin.NONE = 0
    margin: Margin.SMALL,
    // default is 'A4'
    format: 'A4',
    // default is 'portrait or landscape'
    orientation: 'portrait',
  },
};

const getTargetElement = () => document.getElementById('containers');

const downloadPdf = () => generatePDF(getTargetElement, options);

const App = () => {
  return (
    <div>
      <Button onClick={downloadPdf}>Download PDF</Button>
      <div className="w-full h-full bg-blue-50" id="containers">
        ola teste de texto
      </div>
    </div>
  );
};

export default App;
