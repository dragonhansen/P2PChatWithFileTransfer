const streamSaver = require('streamsaver');
const io = require("socket.io-client");

var peer = null //own peer object
var conn = []
var file = null 
var gotFile = false
var filename = ""
const worker = new Worker("../worker.js");
var socket = null
var url = window.location.href;
const roomID = url.substring((url.lastIndexOf('/')+1));


function initialize(){
    socket = io.connect("/");
    
    socket.on("all users", users => {
        connect2(users);
    });
    
    peer = new Peer();
    // on open will be launch when you successfully connect to PeerServer
    peer.on('open', function(id){
        document.getElementById("PeerID").innerHTML = id;
        socket.emit("join", ([roomID, id]));
    });

    peer.on('connection', function(c) {
        conn.push(c);
        console.log("connected to: " + c.peer);
        ready(c);
    })

    // Check if File API is supported
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        // All the File APIs are supported.
      } else {
        alert('The File APIs are not fully supported in this browser.');
      }
}

function connect2(IDs){
    IDs.forEach(id => {
        console.log("connected to peer with ID: "+ id)
        c = peer.connect(id)
        conn.push(c)
        ready(c)
    });
}

function connect(){
    const ID = document.getElementById("conn-id-field").value;
    conn = peer.connect(ID)
    console.log("connected to peer with ID: "+ ID)
}

function ready(c){
    let connTable = document.getElementById("listOfConn");
    let row = connTable.insertRow(-1);
    let cell = row.insertCell(-1)
    let text = document.createTextNode(c.peer);
    cell.appendChild(text)

    c.on('open', function() {
        // Receive messages
        c.on('data', handleReceivingData);
    });
}

// For sending msg
function sendMsg(){
    const msg = sendMessageBox.value;
    conn.forEach(c => {
        if (c && c.open) {
            c.send(msg);
            console.log("Sent: " + msg)
        } else{
            console.log("No conection")
        }
    })
    sendMessageBox.value = "";
}

function handleFile(evt){
    file = evt.target.files[0];
}

function handleReceivingData(data){
    console.log(data)
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
    conn.forEach(c =>{
        if (c && c.open) {
            const stream = file.stream();
            const reader = stream.getReader();
    
            reader.read().then(obj => {
                handlereading(obj.done, obj.value);
            });
    
            function handlereading(done, value) {
                if (done) {
                    c.send(JSON.stringify({ done: true, fileName: file.name }));
                    return;
                }
    
                c.send(value);
                reader.read().then(obj => {
                    handlereading(obj.done, obj.value);
                })
            }
        } else{
            console.log("No conection")
        }
    });
} 

function updateDownloadButton(state){
    if (state){
        document.getElementById("downloadFile").style.display = "block"
    } else {
        document.getElementById("downloadFile").style.display = "none"
    }
}