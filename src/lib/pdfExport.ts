import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

/**
 * Export a DOM element as a multi-page A4 PDF.
 * Converts Recharts SVGs to inline data URIs first to avoid html2canvas issues.
 */
export async function exportProgramPDF(elementId: string, filename = 'Homium-Program-Analysis.pdf') {
  const element = document.getElementById(elementId)
  if (!element) throw new Error(`Element #${elementId} not found`)

  // Clone the element so we can modify SVGs without affecting the live DOM
  const clone = element.cloneNode(true) as HTMLElement
  clone.style.position = 'absolute'
  clone.style.left = '-9999px'
  clone.style.top = '0'
  clone.style.width = `${element.offsetWidth}px`
  document.body.appendChild(clone)

  try {
    // Convert all SVGs in the clone to canvas elements (fixes Recharts rendering)
    await convertSVGsToCanvas(clone)

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      // Give it a generous window size to avoid clipping
      windowWidth: element.offsetWidth,
      windowHeight: element.scrollHeight,
    })

    // Validate the canvas actually rendered something
    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error('html2canvas produced an empty canvas')
    }

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

    // Use blob download for broader browser compatibility
    const blob = pdf.output('blob')
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } finally {
    document.body.removeChild(clone)
  }
}

/**
 * Convert SVG elements to canvas images so html2canvas can render them.
 * Recharts renders charts as <svg> which html2canvas often fails to capture.
 */
async function convertSVGsToCanvas(container: HTMLElement): Promise<void> {
  const svgs = container.querySelectorAll('svg')

  for (const svg of svgs) {
    try {
      const svgData = new XMLSerializer().serializeToString(svg)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      const img = new Image()
      img.crossOrigin = 'anonymous'

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            const width = svg.clientWidth || svg.getBoundingClientRect().width || 300
            const height = svg.clientHeight || svg.getBoundingClientRect().height || 200
            canvas.width = width * 2
            canvas.height = height * 2
            canvas.style.width = `${width}px`
            canvas.style.height = `${height}px`

            const ctx = canvas.getContext('2d')
            if (ctx) {
              ctx.scale(2, 2)
              ctx.drawImage(img, 0, 0, width, height)
            }

            svg.parentNode?.replaceChild(canvas, svg)
            resolve()
          } catch (e) {
            reject(e)
          } finally {
            URL.revokeObjectURL(url)
          }
        }
        img.onerror = () => {
          URL.revokeObjectURL(url)
          // If SVG conversion fails, leave the original SVG — html2canvas may still partially render it
          resolve()
        }
      })
    } catch {
      // Skip this SVG and continue with others
    }
  }
}
