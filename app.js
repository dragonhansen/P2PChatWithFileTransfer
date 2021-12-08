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
var localFiles = [];
var temp = [];

//fired from index.html when loaded
function initialize(){
    socket = io.connect("/");
    
    socket.on("all users", ([users, f]) => {
        connect(users);
        f.forEach(file => {
            files[file.filename] = file.peers
            updateFilesTable(true, file.filename)
        })
    });

    socket.on("updateConn", ([rID, peerID]) => {
        if(rID == roomID){
            updateConnTable(peerID, false)
            conns = conns.filter(function( obj ) {
                return obj.peer !== peerID;
            });
            
            for (const [key, value] of Object.entries(files)) {
                files[key] = files[key].filter(id => id !== peerID)
                console.log(files[key].length, files[key])
                if (files[key].length == 0){
                    delete files[key]
                    updateFilesTable(false, key)
                }
              }
        }
    });

    socket.on("updateFiles", ([rID, pID, fName]) => {
        if (rID == roomID){
            if(files[fName]){
                files[fName].push(pID)
            } else {
                files[fName] = [pID]
                // we only add a new cell in our table when a new file has been sent
                updateFilesTable(true, fName)
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
        c.on('data', data => {
            if (data.toString().startsWith("gibFilePls/")){
                split1 = data.toString().indexOf("//") 
                split2 = data.toString().indexOf("///")
                ourPeerNumber = data.toString().substring(11, split1)
                totalPeers = data.toString().substring(split1+2, split2)
                fName = data.toString().substring(split2+3)
                localFiles[fName].arrayBuffer().then(buffer => {
                    const totalBytes = buffer.byteLength;
                    const sendbytes = Math.floor(totalBytes/totalPeers)
                    bytesproccesed = 0
                    for (let i = 1; i <= totalPeers; i++){
                        if (i == ourPeerNumber){
                            if (i == totalPeers){
                                partToSend = buffer.slice(bytesproccesed);
                            } else {
                                partToSend = buffer.slice(bytesproccesed, bytesproccesed+sendbytes);
                            }
                        } else {
                            bytesproccesed += sendbytes
                        }
                    }

                    c.send({
                    wantNewFile: true, 
                    part: ourPeerNumber, 
                    totalLength: totalPeers,
                    name: fName, 
                    file: partToSend})
                })

            } else {
                handleReceivingData(data)
            }
        });
    });
}

// For sending msg
function sendMsg(){
    const msg = sendMessageBox.value;
    conns.forEach(c => {
        if (c && c.open) {
            c.send({
                isMessage: true,
                message: msg,
                sendingPeer: peer["id"]});
        } else{
            console.log("No conection")
        }
    })
    insertMessage(peer["id"], msg)
    sendMessageBox.value = "";
}

function handleFile(evt){
    file = evt.target.files[0];
}

function handleReceivingData(data){
    if (data.isMessage){
        insertMessage(data.sendingPeer, data.message)
    }
    if (data.wantNewFile){
        console.log(data.file)
        temp[data.part-1] = data.file
        if(temp.length == data.totalLength && !temp.includes(undefined)){
            buffer = []
            for(let i = 0; i<data.totalLength; i++){
                buffer.push(temp[i])
            }

            filename = data.name;
            const file = new Blob(buffer);
            console.log("TORRENT_DONE", Date.now())
            console.log("file", file)
            const stream = file.stream();
            const fileStream = streamSaver.createWriteStream(filename);
            stream.pipeTo(fileStream);
            temp = []
            localFiles[filename] = file
            socket.emit("file", ([roomID, peer["id"], filename]));
        }
    }
    if (data.toString().includes("done")) {
        console.log("Received data")
        gotFile = true
        updateDownloadButton(gotFile)
        const parsed = JSON.parse(data);
        filename = parsed.fileName;
        console.log("DONE", Date.now())
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
        if (!localFiles[filename]){
            localFiles[filename] = event.data
        }
        const stream = event.data.stream();
        const fileStream = streamSaver.createWriteStream(filename);
        stream.pipeTo(fileStream);
        remove = true
        socket.emit("file", ([roomID, peer["id"], filename]));
    })
}

// For sending file
function sendFile(){
    console.log("START", Date.now())
    const stream = file.stream();
    const reader = stream.getReader();
    conns.forEach(c => {
        if (c && c.open) {
            let array = [];

            reader.read().then(obj => {
                handlereading(obj.done, obj.value);
            });
            
            function handlereading(done, value) {
                if (done) {
                    c.send(JSON.stringify({ done: true, fileName: file.name }));
                    if (!localFiles[file.name]){
                        const blob = new Blob(array);
                        localFiles[file.name] = blob
                    }
                    return;
                }
    
                c.send(value);
                if (!localFiles[file.name]){
                    array.push(value)
                }
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
function updateFilesTable(add, fName) {
    let fileTable = document.getElementById("listOfFiles");
    if (add){
        // new file has been sent
        let row = fileTable.insertRow(-1);
        let cell = row.insertCell(-1)
        let cell2 = row.insertCell(-1)
        let text = document.createTextNode(fName);
        cell.appendChild(text)
        
        var btn = document.createElement('button');
        btn.type = "button";
        btn.value = fName
        btn.onclick = function() {downloadFile(fName)};
        btn.innerHTML = "Download file"
        cell2.appendChild(btn);
    } else {
        // peer has disconnected and we therefore remove the file if no other peer has it
        for (let i in fileTable.rows) {
            check = fileTable.rows[i].cells[0].innerHTML
            if(check == fName){
                fileTable.rows[i].remove();
                // found the peer that has disconnected
                break
            }
        }
    }
}

function downloadFile(fName) {
    let peers = files[fName]
    console.log("PEERS", peers)
    var length = 0
    if (localFiles[fName]){
        length = peers.length -1
    } else {
        length = peers.length
    }
    count = 1
    conns.forEach(conn => {
        if (peers.includes(conn.peer)){
            conn.send("gibFilePls/"+count+"//"+length+"///"+fName)
            count++
        }
    })
}

function insertMessage(id, msg) {
    let messageTable = document.getElementById("listOfMessages")
        if(messageTable.rows.length == 20) {
            for (let i = 1; i < 19; i++) {
                messageTable.rows[i].cells[0].innerHTML = messageTable.rows[i+1].cells[0].innerHTML
            }
            messageTable.rows[19].cells[0].innerHTML = ""+id+": " + msg
        } else {
            const row = messageTable.insertRow(-1);
            const cell = row.insertCell(-1);
            
            cell.innerHTML = (""+id+": " + msg);
        }
}