This repository contains an example application for the [storage abstraction package](https://github.com/tweedegolf/storage-abstraction)

The example uses and Ts.ED and TypeORM and it consists of both a backend and a frontend.

```bash
# install dependencies
docker-compose run frontend npm i
docker-compose run backend npm i

# start both frontend and backend server
docker-compose up
```

Now the application should be available at <https://localhost> (make sure you've stopped any local process that use port 80 or set a different port in the `docker-compose.yaml` file).

### Frontend

The frontend shows a listing of images. You can:

- Upload new images to the storage (multiple file upload is supported)
- View a full-screen version of the image by clicking on the thumbnail
- Remove images from the storage

You can create new buckets or delete buckets in the storage as well. Also you can switch between different storages if you have added multiple storage configurations in the backend.

### Backend

The backend provides an API that the frontend talks to. It creates thumbnails from the uploaded images and it maintains a connection to the selected storage:

- Add/delete the images to/from the storage
- Create, select and remove buckets in the storage

The backend also stores some metadata of the uploaded images in a Postgres database:

- file-size
- original filename
- path (including the filename) of the file in the storage
- date created
- date updated

This data is (partly) used to populate the file list on the frontend. Additionally you can find the Swagger documentation of the API at <https://localhost/docs> if the application is running.

### Configuration of the backend

You can use the local storage type without any configuration but to be able to use the Google Cloud and Amazon S3 storage types you need provide some credentials, see the documentation on this here: [Google](https://cloud.google.com/storage/docs/) and [Amazon](https://aws.amazon.com/s3/). In both cases you need to create an account first.

In the example the credentials are read as environment variables. You can use the file `.env.default` as a starting point for creating your own `.env` file. Note that you may change the names of the environment variables to your liking but if you've changed them in the `.env` file you have to change them in the code as well.

In the constructor of [`MediaFileService`](https://github.com/tweedegolf/storage-abstraction/blob/master/example/backend/src/services/MediaFileService.ts) the storage configurations are read from the environment variables. In this example 4 different storage configurations are added to the backend and on line 65 an instance of `Storage` gets created using the first configuration.

In the method `getInitData` a list of the storage configuration ids is sent to the frontend where it populates a dropdown menu that allows the user to quickly switch between the configured storages. If you have added only 1 storage configuration the dropdown menu is not shown.

If a default storage configuration is set, `getInitData` also sends a list of buckets in that storage and if a default bucket is set a list of files in that bucket is sent along as well. The list of files gets added to the init data in the [`StorageController`](https://github.com/tweedegolf/storage-abstraction/blob/master/example/backend/src/controllers/StorageController.ts#L21). From here the method `synchronize` on the `MediaFileService` is called to synchronize the content of the database with the content of the bucket. The content of the bucket is leading.

### Basic setup

The example aims to show all functionality of the storage abstraction package but in most cases you probable need only one single bucket in one single storage. Then you can simply instantiate a storage and provide a bucket name in the config as described [above](#instantiate-a-storage).

## Something else

When looking into the code of the example you may notice that the TypeORM backend [entities](https://github.com/tweedegolf/storage-abstraction/tree/master/example/backend/src/entities) are used on the frontend as well. This is accomplished by shims that are part of the TypeORM library and that you can use on the frontend. These shims contain all decorator functions that are available in TypeORM, only they don't actually do anything, they are just stub functions.

The shims are stored in the folder `example/frontend/shim` and in this folder you also find a small shim for the Ts.ED decorators that are used by the models. If your code needs more decorators you can simply add extra stub functions.

For compiling the frontend you have to add the path to these shims to the `browser` key in your `package.json` file; this instructs Parcel to use the shim files instead of looking for the modules in the `node_modules` folder when it encounters an import from TypeORM or Ts.ED, e.g. `import { Entity } from 'typeorm'`:

```
  "browser": {
    "typeorm": "./shim/typeorm.js",
    "@tsed/common": "./shim/tsed.js"
  },
```

More information about this can be found here:

- <https://github.com/typeorm/typeorm/issues/2841>
- <https://github.com/typeorm/typeorm/issues/62>

## Questions and requests

Please let us know if you have any questions and/or request by creating an [issue](https://github.com/tweedegolf/storage-abstraction/issues).
