import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export interface AddReviewData {
  review_upsert: Review_Key;
}

export interface AddReviewVariables {
  movieId: UUIDString;
  rating: number;
  reviewText: string;
}

export interface CreateMovieData {
  movie_insert: Movie_Key;
}

export interface CreateMovieVariables {
  title: string;
  genre: string;
  imageUrl: string;
}

export interface DeleteReviewData {
  review_delete?: Review_Key | null;
}

export interface DeleteReviewVariables {
  movieId: UUIDString;
}

export interface GetMovieByIdData {
  movie?: {
    id: UUIDString;
    title: string;
    imageUrl: string;
    genre?: string | null;
    metadata?: {
      rating?: number | null;
      releaseYear?: number | null;
      description?: string | null;
    };
      reviews: ({
        reviewText?: string | null;
        reviewDate: DateString;
        rating?: number | null;
        user: {
          id: string;
          username: string;
        } & User_Key;
      })[];
  } & Movie_Key;
}

export interface GetMovieByIdVariables {
  id: UUIDString;
}

export interface ListMoviesData {
  movies: ({
    id: UUIDString;
    title: string;
    imageUrl: string;
    genre?: string | null;
  } & Movie_Key)[];
}

export interface ListUserReviewsData {
  user?: {
    id: string;
    username: string;
    reviews: ({
      rating?: number | null;
      reviewDate: DateString;
      reviewText?: string | null;
      movie: {
        id: UUIDString;
        title: string;
      } & Movie_Key;
    })[];
  } & User_Key;
}

export interface ListUsersData {
  users: ({
    id: string;
    username: string;
  } & User_Key)[];
}

export interface MovieMetadata_Key {
  id: UUIDString;
  __typename?: 'MovieMetadata_Key';
}

export interface Movie_Key {
  id: UUIDString;
  __typename?: 'Movie_Key';
}

export interface Review_Key {
  userId: string;
  movieId: UUIDString;
  __typename?: 'Review_Key';
}

export interface SearchMovieData {
  movies: ({
    id: UUIDString;
    title: string;
    genre?: string | null;
    imageUrl: string;
  } & Movie_Key)[];
}

export interface SearchMovieVariables {
  titleInput?: string | null;
  genre?: string | null;
}

export interface UpsertUserData {
  user_upsert: User_Key;
}

export interface UpsertUserVariables {
  username: string;
}

export interface User_Key {
  id: string;
  __typename?: 'User_Key';
}

/** Generated Node Admin SDK operation action function for the 'CreateMovie' Mutation. Allow users to execute without passing in DataConnect. */
export function createMovie(dc: DataConnect, vars: CreateMovieVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMovieData>>;
/** Generated Node Admin SDK operation action function for the 'CreateMovie' Mutation. Allow users to pass in custom DataConnect instances. */
export function createMovie(vars: CreateMovieVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateMovieData>>;

/** Generated Node Admin SDK operation action function for the 'UpsertUser' Mutation. Allow users to execute without passing in DataConnect. */
export function upsertUser(dc: DataConnect, vars: UpsertUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertUserData>>;
/** Generated Node Admin SDK operation action function for the 'UpsertUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function upsertUser(vars: UpsertUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<UpsertUserData>>;

/** Generated Node Admin SDK operation action function for the 'AddReview' Mutation. Allow users to execute without passing in DataConnect. */
export function addReview(dc: DataConnect, vars: AddReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddReviewData>>;
/** Generated Node Admin SDK operation action function for the 'AddReview' Mutation. Allow users to pass in custom DataConnect instances. */
export function addReview(vars: AddReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddReviewData>>;

/** Generated Node Admin SDK operation action function for the 'DeleteReview' Mutation. Allow users to execute without passing in DataConnect. */
export function deleteReview(dc: DataConnect, vars: DeleteReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteReviewData>>;
/** Generated Node Admin SDK operation action function for the 'DeleteReview' Mutation. Allow users to pass in custom DataConnect instances. */
export function deleteReview(vars: DeleteReviewVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<DeleteReviewData>>;

/** Generated Node Admin SDK operation action function for the 'ListMovies' Query. Allow users to execute without passing in DataConnect. */
export function listMovies(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListMoviesData>>;
/** Generated Node Admin SDK operation action function for the 'ListMovies' Query. Allow users to pass in custom DataConnect instances. */
export function listMovies(options?: OperationOptions): Promise<ExecuteOperationResponse<ListMoviesData>>;

/** Generated Node Admin SDK operation action function for the 'ListUsers' Query. Allow users to execute without passing in DataConnect. */
export function listUsers(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListUsersData>>;
/** Generated Node Admin SDK operation action function for the 'ListUsers' Query. Allow users to pass in custom DataConnect instances. */
export function listUsers(options?: OperationOptions): Promise<ExecuteOperationResponse<ListUsersData>>;

/** Generated Node Admin SDK operation action function for the 'ListUserReviews' Query. Allow users to execute without passing in DataConnect. */
export function listUserReviews(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListUserReviewsData>>;
/** Generated Node Admin SDK operation action function for the 'ListUserReviews' Query. Allow users to pass in custom DataConnect instances. */
export function listUserReviews(options?: OperationOptions): Promise<ExecuteOperationResponse<ListUserReviewsData>>;

/** Generated Node Admin SDK operation action function for the 'GetMovieById' Query. Allow users to execute without passing in DataConnect. */
export function getMovieById(dc: DataConnect, vars: GetMovieByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMovieByIdData>>;
/** Generated Node Admin SDK operation action function for the 'GetMovieById' Query. Allow users to pass in custom DataConnect instances. */
export function getMovieById(vars: GetMovieByIdVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMovieByIdData>>;

/** Generated Node Admin SDK operation action function for the 'SearchMovie' Query. Allow users to execute without passing in DataConnect. */
export function searchMovie(dc: DataConnect, vars?: SearchMovieVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SearchMovieData>>;
/** Generated Node Admin SDK operation action function for the 'SearchMovie' Query. Allow users to pass in custom DataConnect instances. */
export function searchMovie(vars?: SearchMovieVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<SearchMovieData>>;

