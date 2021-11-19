const express = require("express")
const http = require("http");
const app = express();
const server = http.createServer(app);
const socket = require('socket.io');
const io = socket(server);
const { v4: uuidv4 } = require('uuid');

const users = {};

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
            io.emit("updateConn", ([roomID, peerID]));
        }
    })
    
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.redirect(`/${uuidv4()}`);
  });

app.get('/:roomID', (req, res) => {
    res.sendFile(__dirname + "/templates/index.html");
});

server.listen(3000, () => {
    console.log('Server started at port 3000');
   });


/**
app.listen(3000, () => {
    console.log("Application started and Listening on port 3000");
});


// serve your css as static
app.use(express.static(__dirname));

app.get("/", (req, res) => {
    roomID = uuidv4();
    rooms.push(roomID);
    res.redirect(`/${roomID}`);
});

app.get(`/${roomID}`, (req, res) => {
    res.sendFile(__dirname + "/templates/index.html");  
}); 
*/