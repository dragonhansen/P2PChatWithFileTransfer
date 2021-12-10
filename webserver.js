const express = require("express")
const http = require("http");
const app = express();
const server = http.createServer(app);
const socket = require('socket.io');
const io = socket(server);
const { v4: uuidv4 } = require('uuid');
var rooms = []; // is used to verify that roomID in URL is valid
var users = [];
var files = []; // used to keep track of which peers have which files in each room

io.on('connection', socket => { 
    socket.on('join', ([roomID, peerID]) => {
        if (users[roomID]) {
            users[roomID].push(peerID);
        } else {
            users[roomID] = [peerID];
        }
        const usersInThisRoom = users[roomID].filter(id => id !== peerID);
        var filesInThisRoom = []
        files.forEach(file => {
            if (file.id == roomID) {
                filesInThisRoom.push({filename: file.fName, peers: file.peers})
            }
        })
        socket.emit("all users", ([usersInThisRoom, filesInThisRoom]));
    });
    socket.on('close', ([roomID, peerID]) => {
        if(users[roomID]){
            if(users[roomID].includes(peerID)){
                users[roomID] = users[roomID].filter(id => id !== peerID);
                if(users[roomID].length == 0){
                    // no more peers in the room, so we remove the roomID from valid URLs
                    rooms = rooms.filter(id => id !== roomID);
                    delete users[roomID]
                }
                var filesToBeRemoved = []
                files.forEach(file => {
                    if (file.id == roomID ){
                        if (file.peers.includes(peerID)){
                            file.peers = file.peers.filter(id => id !== peerID)
                            if (file.peers.length == 0){
                                filesToBeRemoved.push(file)
                            }
                        }
                    }
                })
                if (filesToBeRemoved.length !== 0){
                    for (let i = 0; i < filesToBeRemoved.length; i++){
                        files.splice(files.findIndex(a => a.fName === filesToBeRemoved[i].fName) , 1)
                    }
                }
                io.emit("updateConn", ([roomID, peerID]));
            }    
        }
    });
    socket.on('file', ([roomID, peerID, fileName]) => {
        var bool = true
        files.forEach( file => {
            if (file.fName == fileName) {
                if(file.id == roomID) {
                    bool = false
                    if(!file.peers.includes(peerID)) {
                        file.peers.push(peerID)
                        io.emit("updateFiles", ([roomID, peerID, fileName]));
                    }
                }
            }
        });
        if(bool) {
            files.push({id: roomID, fName: fileName, peers: [peerID]})
            io.emit("updateFiles", ([roomID, peerID, fileName]));
        }
        
    })
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    const roomID = uuidv4();
    rooms.push(roomID);
    res.redirect(`/${roomID}`);
  });

app.get('/:roomID', (req, res) => {
    if (rooms.includes(req.params['roomID'])) {
        res.sendFile(__dirname + "/templates/index.html");
    } else {
        res.sendStatus(404);
    }
});
/**
 * 
 
server.listen(port = 3000, () => {
    console.log('Server started at port 3000');
   });
*/
server.listen(port = 3000, host = "10.0.1.201", () => {
    console.log('Server started at port 3000');
   });
