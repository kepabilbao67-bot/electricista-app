import type {
  ResearchedCompany,
  ScoredLead,
  ScoreFactor,
  PriorityLevel,
} from './types';

export class ScoringService {
  scoreCompany(
    company: ResearchedCompany,
    recommendedProduct = 'Autónomo360'
  ): ScoredLead {
    const breakdown: ScoreFactor[] = [];

    // Factor 1: Sector Fit (VERIFICADO)
    const isElectricianOrCraft =
      company.sector.value?.toLowerCase().includes('eléctric') ||
      company.sector.value?.toLowerCase().includes('instal');

    breakdown.push({
      factorId: 'sector_fit',
      name: 'Alineación de Sector Profesional',
      value: company.sector.value || 'Desconocido',
      points: isElectricianOrCraft ? 20 : 10,
      maxPoints: 20,
      evidenceType: company.sector.confidence,
      evidence: company.sector.evidence || 'Actividad comprobada en el registro de la fuente',
    });

    // Factor 2: Address / Location (VERIFICADO / INFERIDO)
    const addressPoints =
      company.address.confidence === 'VERIFICADO' ? 15 : company.address.value ? 8 : 0;
    breakdown.push({
      factorId: 'address_location',
      name: 'Localización Geográfica',
      value: company.address.value || 'No disponible',
      points: addressPoints,
      maxPoints: 15,
      evidenceType: company.address.confidence,
      evidence:
        company.address.evidence ||
        (addressPoints > 0
          ? 'Zona geográfica coincidente con el ámbito de prospección'
          : 'Sin dirección registrada en la fuente'),
    });

    // Factor 3: Verified Phone (VERIFICADO)
    const phonePoints = company.phone.confidence === 'VERIFICADO' ? 15 : 0;
    breakdown.push({
      factorId: 'direct_phone',
      name: 'Teléfono de Contacto Directo',
      value: company.phone.value || 'No disponible',
      points: phonePoints,
      maxPoints: 15,
      evidenceType: company.phone.confidence,
      evidence: company.phone.evidence || 'Sin teléfono público verificado',
    });

    // Factor 4: Verified Email (VERIFICADO)
    const emailPoints = company.email.confidence === 'VERIFICADO' ? 10 : 0;
    breakdown.push({
      factorId: 'direct_email',
      name: 'Correo Electrónico Corporativo',
      value: company.email.value || 'No disponible',
      points: emailPoints,
      maxPoints: 10,
      evidenceType: company.email.confidence,
      evidence: company.email.evidence || 'Sin email verificado en la fuente',
    });

    // Factor 5: Website Presence
    let websitePoints = 0;
    if (company.website.status === 'WEBSITE_VERIFICADA') {
      websitePoints = 10;
    } else if (company.website.status === 'URL_PUBLICADA_EN_FUENTE') {
      websitePoints = 6;
    }
    breakdown.push({
      factorId: 'website_presence',
      name: 'Presencia Digital / Sitio Web',
      value: company.website.url || 'No disponible',
      points: websitePoints,
      maxPoints: 10,
      evidenceType: company.website.confidence,
      evidence: company.website.notes || 'Estado del sitio web evaluado',
    });

    // Factor 6: Inferred Need - Field Work Reports (INFERIDO)
    const workReportsPoints = company.inferredNeeds.workReports.value ? 10 : 0;
    breakdown.push({
      factorId: 'inferred_work_reports',
      name: 'Necesidad Inferida: Partes de Trabajo en Movilidad',
      value: company.inferredNeeds.workReports.value ? 'Probable' : 'No aplicable',
      points: workReportsPoints,
      maxPoints: 10,
      evidenceType: company.inferredNeeds.workReports.confidence,
      evidence: company.inferredNeeds.workReports.evidence,
    });

    // Factor 7: Inferred Need - Estimates / Budgets (INFERIDO)
    const budgetsPoints = company.inferredNeeds.budgets.value ? 10 : 0;
    breakdown.push({
      factorId: 'inferred_budgets',
      name: 'Necesidad Inferida: Presupuestos y Certificaciones',
      value: company.inferredNeeds.budgets.value ? 'Probable' : 'No aplicable',
      points: budgetsPoints,
      maxPoints: 10,
      evidenceType: company.inferredNeeds.budgets.confidence,
      evidence: company.inferredNeeds.budgets.evidence,
    });

    // Factor 8: Inferred Need - Invoicing / Compliance (INFERIDO)
    const invoicingPoints = company.inferredNeeds.invoicing.value ? 10 : 0;
    breakdown.push({
      factorId: 'inferred_invoicing',
      name: 'Necesidad Inferida: Facturación y Normativa Fiscal',
      value: company.inferredNeeds.invoicing.value ? 'Probable' : 'No aplicable',
      points: invoicingPoints,
      maxPoints: 10,
      evidenceType: company.inferredNeeds.invoicing.confidence,
      evidence: company.inferredNeeds.invoicing.evidence,
    });

    const totalScore = breakdown.reduce((sum, item) => sum + item.points, 0);

    let priority: PriorityLevel = 'BAJA';
    if (totalScore >= 75) {
      priority = 'MUY ALTA';
    } else if (totalScore >= 55) {
      priority = 'ALTA';
    } else if (totalScore >= 35) {
      priority = 'MEDIA';
    }

    return {
      company,
      totalScore,
      priority,
      breakdown,
      recommendedProduct,
      scoredAt: new Date().toISOString(),
    };
  }
}
