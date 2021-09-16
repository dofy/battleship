import Head from 'next/head';

export default function Home() {
  return (
    <div className='flex flex-col items-center justify-center min-h-screen py-2'>
      <Head>
        <title>Battleship!</title>
        <link rel='icon' href='/favicon.ico' />
      </Head>

      <main className='flex flex-col items-center justify-center w-full flex-1 px-20 text-center'>
        <h1 className='text-6xl font-bold'>🚢 Battleship!</h1>

        <div className='flex flex-wrap items-center justify-around max-w-4xl mt-6 sm:w-full'>
          <a
            href='/api/hello'
            className='p-6 mt-6 text-left border w-96 rounded-xl hover:text-blue-600 focus:text-blue-600'
          >
            <h3 className='text-2xl font-bold'>API &rarr;</h3>
            <p className='mt-4 text-xl'>hello</p>
          </a>
        </div>
      </main>

      <footer className='flex flex-col items-center justify-center w-full h-24 border-t'>
        <div>Copyright &copy; 2021 phpz.xyz</div>
        <div>
          <a
            className='flex items-center justify-center'
            href='https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app'
            target='_blank'
            rel='noopener noreferrer'
          >
            Powered by{' '}
            <img src='/vercel.svg' alt='Vercel Logo' className='h-4 ml-2' />
          </a>
        </div>
      </footer>
    </div>
  );
}
