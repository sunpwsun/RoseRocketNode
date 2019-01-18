const express = require("express")
const initData = require('./initData')

const app = express()

// For fixing error - No 'Access-Control-Allow-Origin'
// https://www.youtube.com/watch?v=cUWcZ4FzgmI
app.use( function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    next()
})



// copys init data
let DriverLocation = { ...initData.DriverLocation }
let Stops = [ ...initData.Stops ] 
let Legs = [...initData.Legs ]
let BonusDriverLocation = { ...initData.BonusDriverLocation }





app.get( '/legs', (req, res, next) => {   
    res.json( Legs )
})

app.get( '/stops', (req, res, next) => {
    res.json( Stops )
})

app.get( '/driver', (req, res, next) => {
    res.json( DriverLocation )
})

app.get( '/bonusdriver', (req, res, next) => {
    res.json( BonusDriverLocation )
})

app.listen( 3005, () => {
    console.log("Server running on port 3005");
})

