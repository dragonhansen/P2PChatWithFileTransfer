const streamSaver = require('streamsaver')

var peer = null //own peer object
var conn = null
var file = null 
var gotFile = false
var filename = ""
var reader = new FileReader()
const worker = new Worker("../worker.js");


function initialize(){
    peer = new Peer();

    // on open will be launch when you successfully connect to PeerServer
    peer.on('open', function(id){
        document.getElementById("PeerID").innerHTML = id;
    });

    peer.on('connection', function(c) {
        conn = c;
        console.log("connected to: " + conn.peer);
        conn.open = true;
        document.getElementById("connection").innerHTML = "Connected to: "+conn.peer
        ready();
    })

    // Check if File API is supported
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        // Great success! All the File APIs are supported.
      } else {
        alert('The File APIs are not fully supported in this browser.');
      }
}

function connect(){
    const ID = document.getElementById("conn-id-field").value;
    conn = peer.connect(ID)
    console.log("connected to peer with ID: "+ ID)
    document.getElementById("connection").innerHTML = "Connected to: "+ID
}

function ready(){
    conn.on('open', function() {
        // Receive messages
        conn.on('data', handleReceivingData);
    });
}

// For sending msg
function sendMsg(){
    if (conn && conn.open) {
        const msg = sendMessageBox.value;
        sendMessageBox.value = "";
        conn.send(msg);
        console.log("Sent: " + msg)
    } else{
        console.log("No conection")
    }
}

function handleFile(evt){
    file = evt.target.files[0];
}

function handleReceivingData(data){
    if (data.toString().includes("done")) {
        console.log("Received data")
        gotFile = true
        updateDownloadButton(gotFile)
        const parsed = JSON.parse(data);
        filename = parsed.fileName;
    } else {
        worker.postMessage(data);
    }
}

function download() {
    gotFile = false
    updateDownloadButton(gotFile)
    worker.postMessage("download");
    worker.addEventListener("message", event => {
        const stream = event.data.stream();
        const fileStream = streamSaver.createWriteStream(filename);
        stream.pipeTo(fileStream);
    })
}

// For sending file
function sendFile(){
    if (conn && conn.open) {
        const stream = file.stream();
        const reader = stream.getReader();

        reader.read().then(obj => {
            handlereading(obj.done, obj.value);
        });

        function handlereading(done, value) {
            if (done) {
                conn.send(JSON.stringify({ done: true, fileName: file.name }));
                return;
            }

            conn.send(value);
            reader.read().then(obj => {
                handlereading(obj.done, obj.value);
            })
        }

    } else{
        console.log("No conection")
    }
} 

function updateDownloadButton(state){
    if (state){
        document.getElementById("downloadFile").style.display = "block"
    } else {
        document.getElementById("downloadFile").style.display = "none"
    }
    
}