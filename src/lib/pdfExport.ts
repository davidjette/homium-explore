import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

/**
 * Export a DOM element as a multi-page A4 PDF.
 * Renders at 2x resolution for crisp output.
 */
export async function exportProgramPDF(elementId: string, filename = 'Homium-Program-Analysis.pdf') {
  const element = document.getElementById(elementId)
  if (!element) throw new Error(`Element #${elementId} not found`)

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF('p', 'mm', 'a4')

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10

  const contentWidth = pageWidth - margin * 2
  const imgWidth = canvas.width
  const imgHeight = canvas.height
  const ratio = contentWidth / imgWidth
  const scaledHeight = imgHeight * ratio

  let heightLeft = scaledHeight
  let position = margin

  // First page
  pdf.addImage(imgData, 'PNG', margin, position, contentWidth, scaledHeight)
  heightLeft -= (pageHeight - margin * 2)

  // Additional pages
  while (heightLeft > 0) {
    position = position - (pageHeight - margin * 2)
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', margin, position, contentWidth, scaledHeight)
    heightLeft -= (pageHeight - margin * 2)
  }

  pdf.save(filename)
}
