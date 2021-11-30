const express = require("express")
const http = require("http");
const app = express();
const server = http.createServer(app);
const socket = require('socket.io');
const io = socket(server);
const { v4: uuidv4 } = require('uuid');
var rooms = []; // is used to verify that roomID in URL is valid
var users = [];

io.on('connection', socket => { 
    socket.on('join', ([roomID, peerID]) => {
        if (users[roomID]) {
            users[roomID].push(peerID);
        } else {
            users[roomID] = [peerID];
        }
        const usersInThisRoom = users[roomID].filter(id => id !== peerID);
        socket.emit("all users", usersInThisRoom);
    });
    socket.on('close', ([roomID,peerID]) => {
        if(users[roomID]){
            users[roomID] = users[roomID].filter(id => id !== peerID);
            if(users[roomID].length == 0){
                // no more peers in the room, so we remove the roomID from valid URLs
                rooms = rooms.filter(id => id !== roomID);
                users = users.filter(id => id !== roomID);
            }
            io.emit("updateConn", ([roomID, peerID]));
        }
        console.log(users)
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
<<<<<<< HEAD

server.listen(port = 3000, host = "localhost", () => {
=======
server.listen(port = 3000, () => {
    console.log('Server started at port 3000');
   });
/** 
server.listen(port = 3000, host = "10.0.1.201", () => {
>>>>>>> 9fecdf7e298e91aa9bdaf72450bbf42fbf38eb53
    console.log('Server started at port 3000');
   });
*/