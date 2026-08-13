const showQrBtn = document.getElementById("show-qr-btn");
const scanQrBtn = document.getElementById("scan-qr-btn");

const qrSection = document.getElementById("qr-section");
const scannerSection = document.getElementById("scanner-section");

showQrBtn.addEventListener("click", () => {
    // Buttons
    showQrBtn.classList.add("active");
    scanQrBtn.classList.remove("active");

    // Sections
    qrSection.classList.remove("hidden");
    scannerSection.classList.add("hidden");
});

scanQrBtn.addEventListener("click", () => {
    // Buttons
    scanQrBtn.classList.add("active");
    showQrBtn.classList.remove("active");

    // Sections
    scannerSection.classList.remove("hidden");
    qrSection.classList.add("hidden");
});