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

    socket.on("updateConn", ([rID, peerID]) => {
        if (rID == roomID){
            var bool = conns.some(function(obj){
                return peerID === obj.peer;
            });
            
            if (bool){
                updateConnTable(peerID, false)
                conns = conns.filter(function( obj ) {
                    return obj.peer !== peerID;
                });
                for (const [key, value] of Object.entries(files)) {
                    files[key] = files[key].filter(id => id !== peerID)
                    if (files[key].length == 0){
                        delete files[key]
                        updateFilesTable(false, key)
                    }
                }
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
        c = peer.connect(id)
        console.log("connected to peer with ID: "+ id)
        conns.push(c)
        ready(c)
    });
}

function ready(c){
    c.peerConnection.onconnectionstatechange = function(event) {
        if(c.peerConnection.connectionState == "disconnected"){
            socket.emit('close', ([roomID, c.peer]))
            updateConnTable(c.peer, false)
            conns = conns.filter(function( obj ) {
                return obj.peer !== c.peer;
            });
            for (const [key, value] of Object.entries(files)) {
                files[key] = files[key].filter(id => id !== c.peer)
                if (files[key].length == 0){
                    delete files[key]
                    updateFilesTable(false, key)
                }
            }
        }
    }

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

                    if (ourPeerNumber == 1) {
                        partToSend = buffer.slice(0, ourPeerNumber*sendbytes);
                    } else if (ourPeerNumber == totalPeers){
                        partToSend = buffer.slice(sendbytes*(ourPeerNumber-1));
                    } else{
                        partToSend = buffer.slice((ourPeerNumber-1)*sendbytes, ourPeerNumber*sendbytes);
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
        temp[data.part-1] = data.file
        if(temp.length == data.totalLength && !temp.includes(undefined)){
            buffer = []
            for(let i = 0; i<data.totalLength; i++){
                buffer.push(temp[i])
            }

            filename = data.name;
            const file = new Blob(buffer);
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
    } else {
        worker.postMessage(data);
    }
}

function download() {
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
        socket.emit("file", ([roomID, peer["id"], filename]));
    })
}

// For sending file
function sendFile(){
    conns.forEach(c => {
        if (c && c.open) {
            const stream = file.stream();
            const reader = stream.getReader();
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
    