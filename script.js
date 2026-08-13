const showQrBtn = document.getElementById("show-qr-btn");
const scanQrBtn = document.getElementById("scan-qr-btn");

const qrSection = document.getElementById("qr-section");
const scannerSection = document.getElementById("scanner-section");

const scannerMessage = document.getElementById("scanner-message");

let qrScanner = null;
let scannerRunning = false;


/* =========================
   SHOW QR
========================= */

showQrBtn.addEventListener("click", async () => {

    showQrBtn.classList.add("active");
    scanQrBtn.classList.remove("active");

    qrSection.classList.remove("hidden");
    scannerSection.classList.add("hidden");

    await stopScanner();
});


/* =========================
   SCAN QR
========================= */

scanQrBtn.addEventListener("click", async () => {

    scanQrBtn.classList.add("active");
    showQrBtn.classList.remove("active");

    qrSection.classList.add("hidden");
    scannerSection.classList.remove("hidden");

    startScanner();
});


/* =========================
   START CAMERA
========================= */

async function startScanner() {

    if (scannerRunning) {
        return;
    }

    if (typeof Html5Qrcode === "undefined") {
        scannerMessage.textContent =
            "QR scanner library not loaded.";
        return;
    }

    scannerMessage.textContent =
        "Starting camera...";

    qrScanner = new Html5Qrcode("reader");

    try {

        await qrScanner.start(
            {
                facingMode: "environment"
            },

            {
                fps: 10,
                qrbox: {
                    width: 250,
                    height: 250
                }
            },

            onScanSuccess,

            onScanFailure
        );

        scannerRunning = true;

        scannerMessage.textContent =
            "Point your camera at a QR code.";

    } catch (error) {

        console.error("Camera error:", error);

        scannerMessage.textContent =
            "Unable to access camera. Allow camera permission and try again.";
    }
}


/* =========================
   QR FOUND
========================= */

function onScanSuccess(decodedText) {

    console.log("QR detected:", decodedText);

    scannerMessage.textContent =
        "QR code detected.";

    // Stop camera after successful scan
    stopScanner();

    // For now, just display the scanned value
    console.log("Scanned data:", decodedText);
}


/* =========================
   SCAN FAILURE
========================= */

function onScanFailure(error) {
    // Ignore normal frame-by-frame scan failures
}


/* =========================
   STOP CAMERA
========================= */

async function stopScanner() {

    if (!qrScanner || !scannerRunning) {
        return;
    }

    try {

        await qrScanner.stop();

        qrScanner.clear();

    } catch (error) {

        console.error(
            "Error stopping scanner:",
            error
        );

    } finally {

        scannerRunning = false;
        qrScanner = null;
    }
}


/* =========================
   STOP CAMERA WHEN LEAVING PAGE
========================= */

window.addEventListener("beforeunload", () => {

    if (qrScanner && scannerRunning) {
        qrScanner.stop().catch(() => {});
    }

});