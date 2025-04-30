'use client';
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          variants: [
            {
              props: { variant: 'contained' },
              style: () => ({
                backgroundColor: '#f5d400',
                color: 'black',
              }),
            },
          ],
        },
      },
    },
  },
});

export default theme;
