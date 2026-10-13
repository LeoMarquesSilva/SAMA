/** Escala de z-index do app — evita sobreposição entre camadas. */
export const Z = {
  nav: 40,
  modal: 100,
  toast: 120,
  confirm: 130,
  /** "Reportar" abre por cima de qualquer modal. */
  reporte: 135,
  popover: 140,
} as const;
