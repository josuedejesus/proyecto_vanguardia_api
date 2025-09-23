#include <SPI.h>
#include "PN532_SPI.h"
#include "PN532.h"

// ================== CONFIG ==================
#define CS1 10
#define CS2 9
// ============================================

PN532_SPI pn532spi1(SPI, CS1);
PN532 nfc1(pn532spi1);

PN532_SPI pn532spi2(SPI, CS2);
PN532 nfc2(pn532spi2);

uint8_t lastUid1[7] = {0}, lastLen1 = 0;
bool wasPresent1 = false;
uint8_t lastUid2[7] = {0}, lastLen2 = 0;
bool wasPresent2 = false;

// ---------- Utils ----------
static inline bool sameUid(const uint8_t* a, uint8_t la, const uint8_t* b, uint8_t lb) {
  if (la != lb) return false;
  for (uint8_t i = 0; i < la; i++) if (a[i] != b[i]) return false;
  return true;
}

static inline void uidToHexNoSpaces(const uint8_t* uid, uint8_t uidLen, char* out, size_t outSize) {
  const char* hex = "0123456789ABCDEF";
  size_t p = 0;
  for (uint8_t i = 0; i < uidLen; i++) {
    if (p + 2 >= outSize) break;
    out[p++] = hex[(uid[i] >> 4) & 0x0F];
    out[p++] = hex[uid[i] & 0x0F];
  }
  out[p] = '\0';
}

// ---------- NDEF URI helpers ----------
/*
  NDEF ‘U’ (URI) con SR (<=255 bytes):
  Header: D1 01 <plen> 'U' <scheme> <rest>
  scheme 0x03 = "http://"
*/
uint8_t buildNdefUriRecord(uint8_t* out, uint8_t maxLen, const char* rest) {
  const uint8_t schemeCode = 0x03;  // "http://"
  uint16_t restLen = (uint16_t)strlen(rest);
  uint16_t payloadLen = 1 + restLen;    // 1 (scheme) + rest
  if (payloadLen > 255) return 0;       // SR
  if (4 + payloadLen > maxLen) return 0;

  uint8_t* p = out;
  *p++ = 0xD1;               // MB|ME|SR + TNF=well-known
  *p++ = 0x01;               // Type Length
  *p++ = (uint8_t)payloadLen;// Payload Length (SR)
  *p++ = 'U';                // Type 'U'
  *p++ = schemeCode;         // "http://"
  for (uint16_t i = 0; i < restLen; i++) *p++ = (uint8_t)rest[i];

  return (uint8_t)(p - out);
}

/*
  TLV: 0x03 <len> <NDEF> 0xFE, escribir desde page 4 (Type 2).
*/
bool writeNdefToUltralight_URL(PN532& nfc, const char* restUrl) {
  uint8_t ndef[240];
  uint8_t ndefLen = buildNdefUriRecord(ndef, sizeof(ndef), restUrl);
  if (ndefLen == 0) return false;

  uint8_t tlv[260];
  uint16_t idx = 0;
  tlv[idx++] = 0x03;                 // NDEF TLV
  tlv[idx++] = (uint8_t)ndefLen;     // length (SR)
  for (uint8_t i = 0; i < ndefLen; i++) tlv[idx++] = ndef[i];
  tlv[idx++] = 0xFE;                 // Terminator
  while (idx % 4 != 0) tlv[idx++] = 0x00;

  uint8_t page = 4, buf[4];
  for (uint16_t i = 0; i < idx; i += 4) {
    buf[0] = tlv[i + 0];
    buf[1] = tlv[i + 1];
    buf[2] = tlv[i + 2];
    buf[3] = tlv[i + 3];
    if (!nfc.mifareultralight_WritePage(page, buf)) return false;
    page++;
  }
  return true;
}

// ---------- Serial JSON ----------
void sendJsonEvent(const char* readerName, const uint8_t* uid, uint8_t uidLen, bool present) {
  Serial.print(F("{\"type\":\"nfc\",\"reader\":\""));
  Serial.print(readerName);
  Serial.print(F("\",\"present\":"));
  Serial.print(present ? F("true") : F("false"));
  Serial.print(F(",\"batch_type_id\":null"));
  if (!present || !uid || uidLen == 0) {
    Serial.print(F(",\"uid\":null,\"uid_len\":0,\"uid_bytes\":[],\"uid_hex_spaced\":null"));
  } else {
    Serial.print(F(",\"uid\":\""));
    for (uint8_t i = 0; i < uidLen; i++) { if (uid[i] < 0x10) Serial.print('0'); Serial.print(uid[i], HEX); }
    Serial.print(F("\",\"uid_len\":")); Serial.print(uidLen);

    Serial.print(F(",\"uid_bytes\":["));
    for (uint8_t i = 0; i < uidLen; i++) { Serial.print(uid[i]); if (i + 1 < uidLen) Serial.print(','); }
    Serial.print(F("],\"uid_hex_spaced\":\""));
    for (uint8_t i = 0; i < uidLen; i++) { if (uid[i] < 0x10) Serial.print('0'); Serial.print(uid[i], HEX); if (i + 1 < uidLen) Serial.print(' '); }
    Serial.print('"');
  }
  Serial.print(F(",\"ts\":")); Serial.print(millis());
  Serial.println(F("}"));
}

// ---------- Setup / Loop ----------
void setup() {
  Serial.begin(115200);
  while (!Serial) {}

  pinMode(10, OUTPUT);
  digitalWrite(10, HIGH);

  SPI.begin();
  SPI.setClockDivider(SPI_CLOCK_DIV8);  // ~2 MHz

  nfc1.begin();
  if (!nfc1.getFirmwareVersion()) { Serial.println(F("PN532 #1 no detectado")); while (1) {} }
  nfc1.setPassiveActivationRetries(0xFF);
  nfc1.SAMConfig();

  nfc2.begin();
  if (!nfc2.getFirmwareVersion()) { Serial.println(F("PN532 #2 no detectado")); while (1) {} }
  nfc2.setPassiveActivationRetries(0xFF);
  nfc2.SAMConfig();

  Serial.println(F("Listo. Se grabará NDEF-URL con el UID en cualquier lector."));
}

void handleReader(PN532& dev, const char* readerName, uint8_t* lastUid, uint8_t& lastLen, bool& wasPresent) {
  uint8_t uid[7]; uint8_t uidLen = 0;
  bool got = dev.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen);

  if (got) {
    if (!wasPresent || !sameUid(uid, uidLen, lastUid, lastLen)) {
      sendJsonEvent(readerName, uid, uidLen, true);

      // Construir URL dinámica con el UID
      char uidHex[2 * 7 + 1];
      uidToHexNoSpaces(uid, uidLen, uidHex, sizeof(uidHex));
      char rest[128];
      snprintf(rest, sizeof(rest), "172.16.240.229:3000/product-passport/%s", uidHex);

      if (writeNdefToUltralight_URL(dev, rest)) {
        Serial.print(F("URL escrita: http://")); Serial.println(rest);
      } else {
        Serial.println(F("No se pudo escribir NDEF-URL (¿no es Ultralight/NTAG o protegida?)."));
      }

      memcpy(lastUid, uid, uidLen);
      lastLen = uidLen;
    }
    wasPresent = true;
  } else if (wasPresent) {
    wasPresent = false; lastLen = 0;
    sendJsonEvent(readerName, nullptr, 0, false);
  }
}

void loop() {
  handleReader(nfc1, "in_reader",  lastUid1, lastLen1, wasPresent1);
  delay(120);
  handleReader(nfc2, "out_reader", lastUid2, lastLen2, wasPresent2);
  delay(120);
}
