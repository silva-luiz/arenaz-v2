import '../index.css';
import PropTypes from 'prop-types';


const Button = ({ text, className, action }) => {


    const handleAction = (e) => {
    action(e);
}

  return (
    <button className={className} onClick={handleAction}>{text}</button>
  )
}

Button.propTypes = {
  text: PropTypes.string.isRequired,
  className: PropTypes.string.isRequired,
  action: PropTypes.func.isRequired,
}



export default Button