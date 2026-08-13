/* =========================================================
   ELEMENTS
========================================================= */

const showQrBtn = document.getElementById("show-qr-btn");
const scanQrBtn = document.getElementById("scan-qr-btn");

const qrSection = document.getElementById("qr-section");
const scannerSection = document.getElementById("scanner-section");

const peerIdElement = document.getElementById("peer-id");

const statusText = document.getElementById("status-text");
const statusDot = document.getElementById("status-dot");

const scannerMessage =
    document.getElementById("scanner-message");

const connectionResult =
    document.getElementById("connection-result");

const connectedPeer =
    document.getElementById("connected-peer");



/* =========================================================
   VARIABLES
========================================================= */

let peer = null;
let connection = null;
let qrScanner = null;
let scannerRunning = false;



/* =========================================================
   STATUS
========================================================= */

function setStatus(text, connected = false) {

    statusText.textContent = text;

    if (connected) {
        statusDot.classList.add("connected");
    } else {
        statusDot.classList.remove("connected");
    }
}



/* =========================================================
   CREATE PEER
========================================================= */

function createPeer() {

    setStatus("Connecting...");

    /*
        PeerJS creates a peer ID automatically.
    */

    peer = new Peer();


    /* -----------------------------------------
       PEER READY
    ----------------------------------------- */

    peer.on("open", (id) => {

        console.log("My Peer ID:", id);

        peerIdElement.textContent = id;

        setStatus("Ready");

        generateQRCode(id);
    });


    /* -----------------------------------------
       INCOMING CONNECTION
    ----------------------------------------- */

    peer.on("connection", (conn) => {

        console.log(
            "Incoming connection from:",
            conn.peer
        );

        setupConnection(conn);
    });


    /* -----------------------------------------
       PEER ERROR
    ----------------------------------------- */

    peer.on("error", (error) => {

        console.error("PeerJS error:", error);

        setStatus("Connection error");

        console.error(
            "Error type:",
            error.type
        );
    });


    /* -----------------------------------------
       DISCONNECTED FROM PEERSERVER
    ----------------------------------------- */

    peer.on("disconnected", () => {

        console.log(
            "Disconnected from PeerServer"
        );

        setStatus("Signaling disconnected");
    });


    /* -----------------------------------------
       PEER CLOSED
    ----------------------------------------- */

    peer.on("close", () => {

        console.log("Peer closed");

        setStatus("Closed");
    });
}



/* =========================================================
   GENERATE QR CODE
========================================================= */

function generateQRCode(peerId) {

    const qrContainer =
        document.getElementById("qrcode");

    qrContainer.innerHTML = "";

    new QRCode(qrContainer, {
        text: peerId,

        width: 220,
        height: 220,

        colorDark: "#111111",
        colorLight: "#ffffff",

        correctLevel: QRCode.CorrectLevel.M
    });

    console.log(
        "QR generated for Peer ID:",
        peerId
    );
}



/* =========================================================
   SETUP CONNECTION
========================================================= */

function setupConnection(conn) {

    connection = conn;


    conn.on("open", () => {

        console.log(
            "P2P connection established"
        );

        console.log(
            "Connected peer:",
            conn.peer
        );

        setStatus(
            "Connected",
            true
        );

        connectedPeer.textContent =
            conn.peer;

        connectionResult.classList.remove(
            "hidden"
        );
    });


    conn.on("data", (data) => {

        /*
            Phase 1 only.

            This proves that the WebRTC
            DataChannel is working.

            File transfer will be added
            in Phase 2.
        */

        console.log(
            "Received data:",
            data
        );
    });


    conn.on("close", () => {

        console.log(
            "Peer connection closed"
        );

        setStatus("Disconnected");

        connectionResult.classList.add(
            "hidden"
        );
    });


    conn.on("error", (error) => {

        console.error(
            "Data connection error:",
            error
        );

        setStatus("Connection error");
    });
}



/* =========================================================
   TOGGLE → MY QR
========================================================= */

showQrBtn.addEventListener(
    "click",
    async () => {

        showQrBtn.classList.add(
            "active"
        );

        scanQrBtn.classList.remove(
            "active"
        );


        qrSection.classList.remove(
            "hidden"
        );

        scannerSection.classList.add(
            "hidden"
        );


        await stopScanner();
    }
);



/* =========================================================
   TOGGLE → SCAN QR
========================================================= */

scanQrBtn.addEventListener(
    "click",
    async () => {

        showQrBtn.classList.remove(
            "active"
        );

        scanQrBtn.classList.add(
            "active"
        );


        qrSection.classList.add(
            "hidden"
        );

        scannerSection.classList.remove(
            "hidden"
        );


        await startScanner();
    }
);



/* =========================================================
   START QR SCANNER
========================================================= */

async function startScanner() {

    if (scannerRunning) {
        return;
    }


    if (
        typeof Html5Qrcode ===
        "undefined"
    ) {

        scannerMessage.textContent =
            "QR scanner library not loaded.";

        return;
    }


    scannerMessage.textContent =
        "Starting camera...";


    qrScanner =
        new Html5Qrcode("reader");


    try {

        const cameras =
            await Html5Qrcode.getCameras();


        if (
            !cameras ||
            cameras.length === 0
        ) {

            scannerMessage.textContent =
                "No camera found.";

            return;
        }


        /*
            Prefer rear camera.
        */

        let cameraId =
            cameras[0].id;


        for (
            const camera of cameras
        ) {

            const label =
                camera.label.toLowerCase();


            if (
                label.includes("back") ||
                label.includes("rear") ||
                label.includes("environment")
            ) {

                cameraId =
                    camera.id;

                break;
            }
        }


        await qrScanner.start(

            cameraId,

            {
                fps: 10,

                qrbox: {
                    width: 250,
                    height: 250
                }
            },

            handleQRCode,

            () => {
                /*
                    Normal scan failure.
                    Ignore it.
                */
            }
        );


        scannerRunning = true;


        scannerMessage.textContent =
            "Point the camera at the QR code.";

    }

    catch (error) {

        console.error(
            "Camera error:",
            error
        );

        scannerMessage.textContent =
            "Unable to access camera.";
    }
}



/* =========================================================
   QR SCANNED
========================================================= */

async function handleQRCode(
    decodedText
) {

    console.log(
        "QR scanned:",
        decodedText
    );


    /*
        The QR currently contains
        only the PeerJS ID.
    */

    const remotePeerId =
        decodedText.trim();


    if (!remotePeerId) {
        return;
    }


    scannerMessage.textContent =
        "Peer found. Connecting...";


    await stopScanner();


    /*
        Connect to the PeerJS peer.
    */

    try {

        const conn =
            peer.connect(
                remotePeerId,
                {
                    reliable: true
                }
            );


        setupConnection(conn);

    }

    catch (error) {

        console.error(
            "Connection failed:",
            error
        );

        scannerMessage.textContent =
            "Unable to connect.";
    }
}



/* =========================================================
   STOP SCANNER
========================================================= */

async function stopScanner() {

    if (
        !qrScanner ||
        !scannerRunning
    ) {
        return;
    }


    try {

        await qrScanner.stop();

        qrScanner.clear();

    }

    catch (error) {

        console.error(
            "Scanner stop error:",
            error
        );

    }


    qrScanner = null;

    scannerRunning = false;
}



/* =========================================================
   START
========================================================= */

createPeer();