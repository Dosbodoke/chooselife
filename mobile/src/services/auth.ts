interface Response {
  token: string;
  user: {
    name: string;
    email: string;
  };
}

export function signIn(): Promise<Response> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        token: 'asdasdasdasdasdasdasdasd',
        user: {
          name: 'John Doe',
          email: 'juangabriel4699@gmail.com',
        },
      });
    }, 2000);
  });
}
