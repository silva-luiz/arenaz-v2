import { useState } from "react"

const SetNumber = () => {

    const [number, setNumber] = useState(10);


  return (
    <div>
        <h1>Increase your number:</h1>
        <p>Your number is: {number}</p>
        <button onClick={() => setNumber(number +2)}>Increase!!</button>
    </div>
  )
}

export default SetNumber