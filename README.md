# PXL Node.js Framework

## Installation

Clone this repository and switch to the project specific Node.js version:

```sh
nvm use
```

## Use library in project

### Publish using Yalc

Use [Yalc](https://github.com/wclr/yalc) to publish the library for local usage using the following command:

```sh
yalc publish
```

### Import in project

After the library has been published with **Yalc**, add it to a project with the following command:

```sh
yalc add @pxl/nodejs-framework
```

And start using in project:

```ts
import { Application } from '@pxl/nodejs-framework';

const app = new Application({
  // ...
});
```

## Development

Run the following command to automatically publish changes through **Yalc** when files are being changed:

```sh
npm run dev
```
