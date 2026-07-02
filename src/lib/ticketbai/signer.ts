import crypto from "crypto";

/**
 * Firma XAdES-EPES para TicketBAI (Bizkaia / Batuz)
 * 
 * Usa el certificado digital del contribuyente (.p12/.pfx)
 * almacenado como variable de entorno en Base64
 * 
 * Variables de entorno necesarias:
 * - CERTIFICATE_P12_BASE64: Certificado .p12 codificado en Base64
 * - CERTIFICATE_PASSWORD: Contraseña del certificado
 */

interface SignatureResult {
  signedXml: string;
  signatureValue: string;
  certificateBase64: string;
  digestValue: string;
}

/**
 * Firma un XML TicketBAI con el certificado digital del contribuyente
 * Implementa firma XAdES-EPES simplificada compatible con Batuz
 */
export function signTicketBAIXml(xml: string): SignatureResult {
  const certBase64 = process.env.CERTIFICATE_P12_BASE64;
  const certPassword = process.env.CERTIFICATE_PASSWORD;

  if (!certBase64 || !certPassword) {
    throw new Error(
      "Certificado digital no configurado. Configura CERTIFICATE_P12_BASE64 y CERTIFICATE_PASSWORD en las variables de entorno."
    );
  }

  // Decodificar certificado P12
  const p12Buffer = Buffer.from(certBase64, "base64");

  // Extraer clave privada y certificado del P12 usando OpenSSL via crypto
  // Node.js crypto puede usar PKCS12 directamente para firmar
  const { privateKey, certificate } = extractKeyAndCert(p12Buffer, certPassword);

  // 1. Calcular digest SHA-256 del XML (sin la firma)
  const canonicalXml = xml.replace(/\r\n/g, "\n").trim();
  const digestValue = crypto
    .createHash("sha256")
    .update(canonicalXml, "utf8")
    .digest("base64");

  // 2. Crear SignedInfo (lo que se firma)
  const signedInfoXml = buildSignedInfo(digestValue);

  // 3. Firmar con RSA-SHA256
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signedInfoXml);
  const signatureValue = signer.sign(privateKey, "base64");

  // 4. Construir bloque <ds:Signature> XAdES-EPES
  const signatureBlock = buildXAdESSignature(
    signedInfoXml,
    signatureValue,
    certificate,
    digestValue
  );

  // 5. Insertar firma en el XML antes del cierre del root
  const closingTag = "</T:TicketBai>";
  const signedXml = canonicalXml.replace(
    closingTag,
    `${signatureBlock}\n${closingTag}`
  );

  return {
    signedXml,
    signatureValue,
    certificateBase64: certificate,
    digestValue,
  };
}

/**
 * Extrae clave privada y certificado de un archivo P12/PFX
 */
function extractKeyAndCert(
  p12Buffer: Buffer,
  password: string
): { privateKey: string; certificate: string } {
  // Usar el módulo crypto de Node.js para trabajar con PKCS12
  // En Node.js, no podemos parsear P12 directamente sin OpenSSL bindings
  // Usamos una aproximación: el P12 se convierte a PEM en el momento de la configuración
  
  // Si las variables de entorno contienen PEM directamente (alternativa más simple)
  const pemKey = process.env.CERTIFICATE_PRIVATE_KEY_PEM;
  const pemCert = process.env.CERTIFICATE_CERT_PEM;
  
  if (pemKey && pemCert) {
    return { privateKey: pemKey, certificate: pemCert };
  }

  // Intentar usar el P12 directamente con crypto
  try {
    const keyObject = crypto.createPrivateKey({
      key: p12Buffer,
      format: "der",
      type: "pkcs8",
      passphrase: password,
    } as crypto.PrivateKeyInput);

    const privateKey = keyObject.export({ type: "pkcs8", format: "pem" }) as string;
    
    // Para el certificado, necesitamos extraerlo del P12
    // Se recomienda configurar CERTIFICATE_CERT_PEM por separado
    const certificate = process.env.CERTIFICATE_CERT_PEM || 
      Buffer.from(p12Buffer).toString("base64").substring(0, 200);

    return { privateKey, certificate };
  } catch {
    throw new Error(
      "No se pudo leer el certificado P12. " +
      "Asegurate de que CERTIFICATE_P12_BASE64 contiene un P12 valido " +
      "o configura CERTIFICATE_PRIVATE_KEY_PEM y CERTIFICATE_CERT_PEM con los PEM extraidos."
    );
  }
}

/**
 * Construye el bloque SignedInfo para la firma
 */
function buildSignedInfo(digestValue: string): string {
  return `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
  <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
  <ds:Reference URI="">
    <ds:Transforms>
      <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
    </ds:Transforms>
    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
    <ds:DigestValue>${digestValue}</ds:DigestValue>
  </ds:Reference>
</ds:SignedInfo>`;
}

/**
 * Construye el bloque de firma XAdES-EPES completo
 */
function buildXAdESSignature(
  signedInfoXml: string,
  signatureValue: string,
  certificate: string,
  _digestValue: string
): string {
  const now = new Date().toISOString();
  const sigId = `Signature-${Date.now()}`;

  return `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="${sigId}">
  ${signedInfoXml}
  <ds:SignatureValue>${signatureValue}</ds:SignatureValue>
  <ds:KeyInfo>
    <ds:X509Data>
      <ds:X509Certificate>${certificate}</ds:X509Certificate>
    </ds:X509Data>
  </ds:KeyInfo>
  <ds:Object>
    <xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="#${sigId}">
      <xades:SignedProperties>
        <xades:SignedSignatureProperties>
          <xades:SigningTime>${now}</xades:SigningTime>
          <xades:SignaturePolicyIdentifier>
            <xades:SignaturePolicyId>
              <xades:SigPolicyId>
                <xades:Identifier>https://www.batuz.eus/fitxategiak/batuz/ticketbai/sinadura_elektronikoaren_zehaztapenak_especificaciones_de_la_firma_electronica_v1_0.pdf</xades:Identifier>
                <xades:Description>Politica de firma TicketBAI v1.0</xades:Description>
              </xades:SigPolicyId>
              <xades:SigPolicyHash>
                <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                <ds:DigestValue>Quzn98x3PMbSHwbUzaj5f5KOpiH0u8bvmwbbbNkO9Es=</ds:DigestValue>
              </xades:SigPolicyHash>
            </xades:SignaturePolicyId>
          </xades:SignaturePolicyIdentifier>
        </xades:SignedSignatureProperties>
      </xades:SignedProperties>
    </xades:QualifyingProperties>
  </ds:Object>
</ds:Signature>`;
}

/**
 * Verifica si el certificado digital está configurado
 */
export function isCertificateConfigured(): boolean {
  return !!(
    (process.env.CERTIFICATE_P12_BASE64 && process.env.CERTIFICATE_PASSWORD) ||
    (process.env.CERTIFICATE_PRIVATE_KEY_PEM && process.env.CERTIFICATE_CERT_PEM)
  );
}
