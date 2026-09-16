import {
  fetchHighlineBeginnerGuideAccess,
  mapCourseAccessResponse,
} from './access';

describe('course access client', () => {
  it('maps an authorized response to the native reader source', () => {
    expect(
      mapCourseAccessResponse({
        documentUrl: 'https://r2.example.com/course-guide.pdf?signature=test',
      }),
    ).toEqual({
      pdfUrl: 'https://r2.example.com/course-guide.pdf?signature=test',
    });
  });

  it('does not accept a response without the server document URL field', () => {
    expect(() =>
      mapCourseAccessResponse({
        url: 'https://r2.example.com/course-guide.pdf',
      }),
    ).toThrow('valid PDF URL');
  });

  it('preserves the forbidden response for the locked UI state', async () => {
    const fetchImpl = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchImpl.mockResolvedValue(new Response(null, { status: 403 }));

    await expect(
      fetchHighlineBeginnerGuideAccess('supabase-token', {
        webUrl: 'https://chooselife.test/',
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: 'COURSE_ACCESS_FORBIDDEN',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://chooselife.test/api/courses/highline-beginner/access',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer supabase-token',
        },
      }),
    );
  });
});
