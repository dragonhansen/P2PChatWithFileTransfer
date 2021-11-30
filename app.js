const streamSaver = require('streamsaver');
const io = require("socket.io-client");

var peer = null //own peer object
var conns = []
var file = null 
var gotFile = false
var filename = ""
const worker = new Worker("../worker.js");
var socket = null
var url = window.location.href;
const roomID = url.substring((url.lastIndexOf('/')+1));
var remove = true;
var files = []

//fired from index.html when loaded
function initialize(){
    socket = io.connect("/");
    
    socket.on("all users", users => {
        connect(users);
    });

    socket.on("updateConn", ([rID, peerID]) => {
        if(rID == roomID){
            updateConnTable(peerID, false)
            conns = conns.filter(function( obj ) {
                return obj.peer !== peerID;
            });
        }
        files.forEach(fname => {
            files[fname].forEach(id => {
                files[fname] = files[fname].filter(id => id !== peerID);
            });
        });
    });

    socket.on("updateFiles", ([rID, pID, fName]) => {
        if (rID == roomID){
            if(files[fName]){
                files[fName].push(pID)
                updateFilesTable(true, false)
            } else {
                files[fName] = [pID]
                updateFilesTable(true, true)
            }
        }
    });
    
    peer = new Peer();
    // on open will be launch when you successfully connect to PeerServer
    peer.on('open', function(id){
        document.getElementById("PeerID").innerHTML = id;
        socket.emit("join", ([roomID, id]));
    });

    peer.on('connection', function(c) {
        conns.push(c);
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

function connect(IDs){
    IDs.forEach(id => {
        console.log("connected to peer with ID: "+ id)
        c = peer.connect(id)
        conns.push(c)
        ready(c)
    });
}

function ready(c){
    updateConnTable(c.peer, true)
    c.on('open', function() {
        // Receive messages
        c.on('data', handleReceivingData);
    });
}

// For sending msg
function sendMsg(){
    const msg = sendMessageBox.value;
    conns.forEach(c => {
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
    remove = false;
    gotFile = false;
    updateDownloadButton(gotFile)
    worker.postMessage("download");
    worker.addEventListener("message", event => {
        const stream = event.data.stream();
        const fileStream = streamSaver.createWriteStream(filename);
        stream.pipeTo(fileStream);
        remove = true
        socket.emit("file", ([roomID, peer["id"], filename]));
    })
}

// For sending file
function sendFile(){
    conns.forEach(c => {
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
    socket.emit("file", ([roomID, peer["id"], file.name]));
} 

function updateDownloadButton(state){
    if (state){
        document.getElementById("downloadFile").style.display = "block"
    } else {
        document.getElementById("downloadFile").style.display = "none"
    }
}

// update the eventlistener, such that beforeunload is not fired when we press the download button
function removePeer(){
    if (remove) {
        socket.emit('close', ([roomID, peer["id"]]))
    }
}

function updateConnTable(peer, add) {
    let connTable = document.getElementById("listOfConn");
    if (add){
        // add peer to table
        let row = connTable.insertRow(-1);
        let cell = row.insertCell(-1)
        let text = document.createTextNode(peer);
        cell.appendChild(text)
    } else {
        //remove peer from table
        //rows[0] is the "Connections" label so we start from 1
        for(var i=1; i <= conns.length; i++){
            check = connTable.rows[i].cells[0].innerHTML
            if(check == peer){
                connTable.rows[i].remove();
                // found the peer that has disconnected
                break
            }
        }
    }
}


// fresh dictates wether we append a append a peerID to a file, or we create a new cell containing a new file.
function updateFilesTable(add, fresh) {
    console.log("FFIIIIELS", files)
    /**
    let lifeTable = document.getElementById("listOfFiles");
    if (add){
        // new peer has file
        let row = connTable.insertRow(-1);
        let cell = row.insertCell(-1)
        let text = document.createTextNode(peer);
        cell.appendChild(text)
        var btn = document.createElement('input');
        btn.type = "button";
        btn.className = "btn";
        btn.value = entry.email;
        btn.onclick = (function(entry) {return function() {chooseUser(entry);}})(entry);
        td.appendChild(btn);
    }
    */
    
}
