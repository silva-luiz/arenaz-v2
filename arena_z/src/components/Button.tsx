const Button = ({ text, className, action }) => {
  return (
    <button className={className} onClick={action}>
      {text}
    </button>
  );
};

// Button.propTypes = {
//   text: PropTypes.string.isRequired,
//   className: PropTypes.string.isRequired,
//   action: PropTypes.func,
// };

export default Button;
