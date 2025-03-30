
const ConditionalRender = () => {

    var x = true;

    var y = false;

  return (
    <div>
        <h3>X será exibido??</h3>
        {x && <h4>Se x for true, sim!</h4>}

        <h3>Y será exibido??</h3>
        {y ? (
            <h4>Se y for true, sim!</h4>
            ) : (
            <h4>Se y for false, não</h4>
            )};
    </div>
  )
}

export default ConditionalRender