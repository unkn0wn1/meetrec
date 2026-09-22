import { Menu, Tray, nativeImage, type BrowserWindow } from 'electron'

const TRAY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAsklEQVR4nO2WQQrCMBBF/0kR8QJi4Q28gBdQ8AJeQMvNPbiCR3DzDk6g4AXcwA0sFBH1IyKbTdK0CfnJZzKZ/CGhA0pHnAEnwAkwA5wBJ8AJMAOcASfACXACnAAn4AVYgU7AC7ACXsALsAJewAuwAl7AC7ACXsALsAJewAuwAl7AC3gBVuAFeIEX4AVegBd4AV7gBXiBF+AFXoAXeAFe4AV4gRfgBV6AF3gBXuAFeIEX4AVegBd4AV7gBXiBF+AFXoAXeAFe4AU+A1b/AVb+A34BKm0n1m0n1j0AAAAASUVORK5CYII=',
  'base64'
)

export function createTray(window: BrowserWindow): Tray {
  const image = nativeImage.createFromBuffer(TRAY_PNG).resize({ width: 16, height: 16 })
  const tray = new Tray(image)
  tray.setToolTip('meetrec')
  const menu = Menu.buildFromTemplate([
    {
      label: 'Show meetrec',
      click: () => {
        window.show()
        window.focus()
      }
    },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' }
  ])
  tray.setContextMenu(menu)
  tray.on('click', () => {
    window.show()
    window.focus()
  })
  return tray
}
