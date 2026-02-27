import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'

/**
 * Export a DOM element as a multi-page A4 PDF.
 * Uses html-to-image (SVG foreignObject) instead of html2canvas
 * because Tailwind v4's oklch() colors crash html2canvas.
 */
export async function exportProgramPDF(elementId: string, filename = 'Homium-Program-Analysis.pdf') {
  const element = document.getElementById(elementId)
  if (!element) throw new Error(`Element #${elementId} not found`)

  const imgData = await toPng(element, {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    cacheBust: true,
  })

  const pdf = new jsPDF('p', 'mm', 'a4')

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10

  // Load image to get dimensions
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to load rendered image'))
    img.src = imgData
  })

  const contentWidth = pageWidth - margin * 2
  const ratio = contentWidth / img.width
  const scaledHeight = img.height * ratio

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

  // Blob download for broad browser compatibility
  const blob = pdf.output('blob')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
