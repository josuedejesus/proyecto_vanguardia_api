const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const { sendNfc } = require("./sse");

const BAUD = Number(process.env.SERIAL_BAUD || 115200);

async function pickPort() {
  const wanted = process.env.SERIAL_PORT;
  if (wanted) return wanted;

  const ports = await SerialPort.list();
  const match = ports.find(p =>
    /arduino|ch340|wch|usb-serial|uno|mega/i.test(
      `${p.manufacturer || ""} ${p.friendlyName || ""} ${p.productId || ""}`
    ) ||
    ["2341", "2A03", "1A86"].includes((p.vendorId || "").toUpperCase())
  );
  if (match) return match.path;

  console.warn("No pude detectar automáticamente el Arduino. Puertos:");
  ports.forEach(p => console.warn(`- ${p.path}  ${p.manufacturer || ""}`));
  throw new Error("Define SERIAL_PORT=COMx o conecta el Arduino.");
}

function startSerial(path) {
  console.log(`Abriendo puerto serie ${path} @ ${BAUD}…`);
  const port = new SerialPort({ path, baudRate: BAUD, autoOpen: false });
  const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

  const open = () => port.open(err => {
    if (err) {
      console.error("Serial open error:", err.message);
      const retryable = /access denied|busy|resource busy|cannot find|no such file/i.test(err.message);
      setTimeout(() => reconnect(), retryable ? 1500 : 4000);
      return;
    }
    console.log("Serial abierto:", path);
  });

  const reconnect = async () => {
    try {
      const newPath = process.env.SERIAL_PORT ? path : await pickPort();
      if (newPath !== path) {
        console.log(`Puerto cambió: ${path} -> ${newPath}`);
      }
      startSerial(newPath);
    } catch (e) {
      console.warn(e.message);
      setTimeout(reconnect, 3000);
    }
  };

  parser.on("data", (line) => {
    line = line.trim();
    try {
      const evt = JSON.parse(line);
      if (evt && evt.type === "nfc" && "uid" in evt) sendNfc(evt);
    } catch {
    }
  });

  port.on("close", () => {
    console.warn("Serial cerrado, reintentando…");
    setTimeout(() => reconnect(), 1500);
  });

  port.on("error", (err) => {
    console.error("Serial error:", err.message);
  });

  process.once("SIGINT", () => port.close(() => process.exit(0)));
  process.once("SIGTERM", () => port.close(() => process.exit(0)));

  open();
}

(async () => {
  try {
    const path = await pickPort();
    startSerial(path);
  } catch (e) {
    console.error(e.message);
  }
})();
