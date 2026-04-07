import { assinarXML } from "./assinarXml";

export async function assinarXMLCancelamento(
  xml: string,
  caminhoKey: string,
  caminhoCert: string
): Promise<string> {
  // Use a mesma lógica do assinarXML, só mudando a tag para 'infEvento'
  return assinarXML(xml, 'infEvento', caminhoKey, caminhoCert);
}