const express = require("express")
const initData = require('./initData')
const bodyParser = require('body-parser')
const socketio = require('socket.io')


const app = express()

// For fixing error - No 'Access-Control-Allow-Origin'
// https://www.youtube.com/watch?v=cUWcZ4FzgmI
app.use( function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    next()
})

app.set('port', 3005)

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())



// vars for simulation
let DriverLocation
let Stops
let Legs
let BonusDriverLocation
let LegsLength = []

// traveled distance from the startStop of this leg  ( Km -> m )
let traveledDist

// index of the current leg
let idxCurrentLeg

// Have the driver arrived at the final ?
let arrivedFinal

// Timestamps
const timestamps = []


function initializeData() {

    // copys init data
    DriverLocation = { ...initData.DriverLocation }
    Stops = [ ...initData.Stops ] 
    Legs = [...initData.Legs ]
    BonusDriverLocation = { ...initData.BonusDriverLocation }

    // calculate every length of each legs
    // distance unit : m
    for( let i = 0 ; i < Stops.length -1 ; i++) {
        const dx = ( Stops[ i + 1 ].x - Stops[ i ].x ) * 1000
        const dy = ( Stops[ i + 1 ].y - Stops[ i ].y ) * 1000
        LegsLength[ i ] = Math.sqrt( Math.abs( dx * dx ) + Math.abs( dy * dy ) )       
    }

    arrivedFinal = false

}

function passedTimestamps() {
    // finds index of the curren leg
    idxCurrentLeg = Legs.findIndex( leg => leg.legID === DriverLocation.activeLegID )

    // traveled distance from this leg  ( Km -> m )
    traveledDist = LegsLength[ idxCurrentLeg ] * DriverLocation.legProgress / 100

    // calc timestamps for passed legs
    // timestamp at startStop of this leg
    const td = LegsLength[ idxCurrentLeg ] * DriverLocation.legProgress / 100
    const tt = td / (Legs[ idxCurrentLeg ].speedLimit * 1000 / 3600)

    // time = distance / time
    let date = new Date()
  
    timestamps[ idxCurrentLeg ] = new Date( date.setSeconds( date.getSeconds() - tt ) )


    for( let i = idxCurrentLeg - 1 ; i >= 0 ; i-- ) {
        const tmpTime = LegsLength[ i ] / ( Legs[ i ].speedLimit * 1000 / 3600 )
        let tmpDate = new Date( timestamps[ i + 1 ] )
        timestamps[ i ] = new Date(  tmpDate.setSeconds( tmpDate.getSeconds() - tmpTime ) )
        console.log( 'TimeStamp]', Stops[i].name, timestamps[ i ] )       
    } 
}

function moveDriver() {

    // driver moves every seconds
    // distance moved per second (m/s)
    const distPerSec =  Legs[ idxCurrentLeg ].speedLimit * 1000 / 3600

    // updates moved distance as %
    traveledDist += distPerSec
    DriverLocation.legProgress = traveledDist / LegsLength[ idxCurrentLeg ] * 100

    // checks if the driver arrives at the endStop
    if( traveledDist >= LegsLength[ idxCurrentLeg ] ) {
        
        traveledDist = 0

        // driver arrived
console.log( idxCurrentLeg, Legs.length )
        if( idxCurrentLeg === Legs.length - 1) {   // arrived at the final stop

            console.log('[Completed Simulation]')
            arrivedFinal = true
            console.log( '[STOP Simulation]')
            clearInterval(timerMoveID)
            //clearInterval(timerSendTimestamp)
        }
        else {
           
            // put the timestamp
            timestamps[ idxCurrentLeg + 1 ] = new Date()

            // next leg
            idxCurrentLeg++
            DriverLocation.activeLegID = Legs[ idxCurrentLeg ].legID
            DriverLocation.legProgress = 0
        }
    }
    console.log('[Moving] ', Legs[ idxCurrentLeg ].legID , '- ', traveledDist + 'M ' + DriverLocation.legProgress + '%'+ new Date())    

    calcEstimatedDistanceTime()
}

function calcEstimatedDistanceTime() {

    // distance left to this and final legs (m)
    const distLeftToThisLeg = LegsLength[ idxCurrentLeg ] - traveledDist

    // time left to endStop of this leg (seconds)
    const timeLeftToThisLeg = distLeftToThisLeg / ( Legs[ idxCurrentLeg ].speedLimit * 1000 / 3600 )

    const date = new Date()
    timestamps[ idxCurrentLeg + 1 ] = new Date( date.setSeconds( date.getSeconds() + timeLeftToThisLeg ) )

    // calc timestamps for legs to pass soon
    for( let i = idxCurrentLeg + 1 ; i <= Legs.length ; i++ ) {

        const tmpTime = LegsLength[ i - 1 ] / ( Legs[ i - 1 ].speedLimit * 1000 / 3600 )
        let tmpDate = new Date( timestamps[ i - 1 ] )
        timestamps[ i ] = new Date(  tmpDate.setSeconds( tmpDate.getSeconds() + tmpTime ) )
    }
}


// REST APIs
app.get( '/legs', (req, res, next) => {   
    console.log(' GET /leg')
    res.json( Legs )
})

app.get( '/stops', (req, res, next) => {
    console.log(' GET /stops')
    res.json( Stops )
})

app.get( '/driver', (req, res, next) => {
    console.log(' GET /driver')
    res.json( DriverLocation )
})

app.get( '/bonusdriver', (req, res, next) => {
    console.log(' GET /bonusdriver')
    res.json( BonusDriverLocation )
})


app.put( '/driver', (req, res) => {
    
    initializeData()
    DriverLocation.activeLegID = req.body.activeLegID
    DriverLocation.legProgress = req.body.legProgress
    idxCurrentLeg = Legs.findIndex( leg => leg.legID === DriverLocation.activeLegID )
    traveledDist = LegsLength[ idxCurrentLeg ] * DriverLocation.legProgress / 100
    passedTimestamps()
    console.log( '[Driver Location Updated]- ', DriverLocation)   
    
    res.json( { message: 'OK' } )
})

app.put( '/bonusdriver', (req, res) => {

    BonusDriverLocation.x = req.body.x
    BonusDriverLocation.y = req.body.y

    console.log( '[Driver Location Updated]- ', BonusDriverLocation)   
    res.json( { message: 'OK' } )
})



const server = require('http').createServer(app)

initializeData()
passedTimestamps()

// setup for socket.io 
const io = socketio( server )

let timerSendTimestamp, timerMoveID

io.on('connection', function (client) {
    console.log( '[ + Client Connect]' )

    // start button clicked on a client side
    // belows will be sening to the client every 1 sec
    // remaining distance and time
    client.on( 'start', () => {
        
        console.log( '[START Simulation]')

        timerMoveID = setInterval( moveDriver, 1000 )

        timerSendTimestamp = setInterval( function() {      
            if( !arrivedFinal ) {            
                client.emit( 'timerSendTimestamp', { timestamps, DriverLocation} )
            }
            else {
                console.log( '[COMPLETED]')   
                client.emit( 'completed' )
                clearInterval(timerSendTimestamp)
            }
        }, 1000 )
    })

    // clients clicked stop btn
    client.on( 'stop',  () => {
        console.log( '[STOP Simulation]')
        clearInterval(timerMoveID)
        clearInterval(timerSendTimestamp)

        initializeData()
        passedTimestamps()
    })

    // disconned
    client.on( 'disconnect', function () {
        console.log('[ - Client Disconnect]', client.id)


        clearInterval(timerMoveID)
        clearInterval(timerSendTimestamp)

        initializeData()
        passedTimestamps()
    })

    client.on('error', function (err) {
        console.log('received error from client:', client.id)
        console.log(err)
    })
})

server.listen(3005, function (err) {
    if (err) throw err
    console.log('listening on port 3005')
})
