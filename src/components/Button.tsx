interface IButton {
  text: string;
  className: string;
  handleClick?: (e: any) => Promise<void>;
  type?: 'button' | 'submit' | 'reset';
}

const Button = ({ text, className, handleClick, type = 'button' }: IButton) => {
  return (
    <button className={className} onClick={handleClick} type={type}>
      {text}
    </button>
  );
};

export default Button;
