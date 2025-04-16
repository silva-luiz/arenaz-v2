import Table from 'react-bootstrap/Table';
import Pagination from 'react-bootstrap/Pagination';
import styles from '../Reservations/ReservationsPage.module.scss';

const active = 1;
const items = [];
for (let number = 1; number <= 5; number++) {
  items.push(
    <Pagination.Item key={number} active={number === active}>
      {number}
    </Pagination.Item>
  );
}

const reservations = [
  {
    arena: 'Arena 1',
    categoria: 'Society',
    locador: 'José da Silva',
    contato: '(12)99123-4456',
    data: '00/00/0000',
    horarioEntrada: '00:00',
    horarioSaida: '02:00',
    valor: 'R$ 130,00',
  },
  {
    arena: 'Arena 1',
    categoria: 'Society',
    locador: 'José da Silva',
    contato: '(12)99123-4456',
    data: '00/00/0000',
    horarioEntrada: '00:00',
    horarioSaida: '02:00',
    valor: 'R$ 130,00',
  },
  {
    arena: 'Arena 1',
    categoria: 'Society',
    locador: 'José da Silva',
    contato: '(12)99123-4456',
    data: '00/00/0000',
    horarioEntrada: '00:00',
    horarioSaida: '02:00',
    valor: 'R$ 130,00',
  },
  {
    arena: 'Arena 1',
    categoria: 'Society',
    locador: 'José da Silva',
    contato: '(12)99123-4456',
    data: '00/00/0000',
    horarioEntrada: '00:00',
    horarioSaida: '02:00',
    valor: 'R$ 130,00',
  },
  {
    arena: 'Arena 1',
    categoria: 'Society',
    locador: 'José da Silva',
    contato: '(12)99123-4456',
    data: '00/00/0000',
    horarioEntrada: '00:00',
    horarioSaida: '02:00',
    valor: 'R$ 130,00',
  },
  {
    arena: 'Arena 1',
    categoria: 'Society',
    locador: 'José da Silva',
    contato: '(12)99123-4456',
    data: '00/00/0000',
    horarioEntrada: '00:00',
    horarioSaida: '02:00',
    valor: 'R$ 130,00',
  },
  {
    arena: 'Arena 1',
    categoria: 'Society',
    locador: 'José da Silva',
    contato: '(12)99123-4456',
    data: '00/00/0000',
    horarioEntrada: '00:00',
    horarioSaida: '02:00',
    valor: 'R$ 130,00',
  },
  // ... repita ou traga seus dados reais aqui
];

const ReservationsPage = () => {
  return (
    <>
      <h2 className={styles.reservationsTitle}>Reservas ativas</h2>
      <p className={styles.reservationsSubtitle}>
        Confira aqui as informações de todas as suas reservas ativas
      </p>

      {/* Tabela para telas maiores */}
      <div className={styles.tableResponsive}>
        <Table
          striped
          bordered
          hover
          variant="dark"
          size="sm"
          className={styles.customTable}
        >
          <thead>
            <tr className={styles.tableHeaderRow}>
              <th className={styles.tableHeader}>Arena</th>
              <th className={styles.tableHeader}>Categoria</th>
              <th className={styles.tableHeader}>Locador</th>
              <th className={styles.tableHeader}>Contato</th>
              <th className={styles.tableHeader}>Data</th>
              <th className={styles.tableHeader}>Horário</th>
              <th className={styles.tableHeader}>Valor</th>
              <th className={styles.tableHeader}>Cancelar reserva</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((reserva, index) => (
              <tr key={index} className={styles.tableRow}>
                <td className={styles.tableData}>{reserva.arena}</td>
                <td className={styles.tableData}>{reserva.categoria}</td>
                <td className={styles.tableData}>{reserva.locador}</td>
                <td className={styles.tableData}>{reserva.contato}</td>
                <td className={styles.tableData}>{reserva.data}</td>
                <td className={styles.tableData}>
                  {reserva.horarioEntrada} - {reserva.horarioSaida}
                </td>
                <td className={styles.tableData}>{reserva.valor}</td>
                <td className={styles.tableData}>
                  <button className={styles.cancelButton}>Cancelar reserva</button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* Versão mobile: cards */}
      <div className={styles.mobileCardsContainer}>
        {reservations.map((reserva, index) => (
          <div key={index} className={styles.mobileCard}>
            <p><strong>Arena:</strong> {reserva.arena}</p>
            <p><strong>Categoria:</strong> {reserva.categoria}</p>
            <p><strong>Locador:</strong> {reserva.locador}</p>
            <p><strong>Contato:</strong> {reserva.contato}</p>
            <p><strong>Data:</strong> {reserva.data}</p>
            <p><strong>Horário:</strong> {reserva.horarioEntrada} - {reserva.horarioSaida}</p>
            <p><strong>Valor:</strong> {reserva.valor}</p>
            <button className={styles.cancelButton}>Cancelar</button>
          </div>
        ))}
      </div>

      
      {/* Pagination - confirmar se teremos ou nao */}
      {/* <div className={styles.reservationPagination}>
        <Pagination>{items}</Pagination>
      </div> */}
    </>
  );
};

export default ReservationsPage;
