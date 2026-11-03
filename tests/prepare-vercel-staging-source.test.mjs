import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {prepareVercelStagingSource,STAGING_SOURCE_FILES} from '../bin/prepare-vercel-staging-source.mjs';

const PIN='0123456789abcdef0123456789abcdef01234567';
function fixture(){
  const dir=mkdtempSync(join(tmpdir(),'papa-vercel-bundle-'));
  const source=join(dir,'source'),output=join(dir,'bundle');
  mkdirSync(source);
  for(const path of STAGING_SOURCE_FILES){
    const target=join(source,path);
    mkdirSync(dirname(target),{recursive:true});
    writeFileSync(target,'test fixture for '+path+'\n');
  }
  mkdirSync(join(source,'netlify'),{recursive:true});
  writeFileSync(join(source,'netlify','do-not-deploy.txt'),'private-not-for-vercel');
  return {dir,source,output};
}

test('staging exporter copies only pinned source files with deterministic content hashes',()=>{
  const {dir,source,output}=fixture();
  try{
    const a=prepareVercelStagingSource({sourceRoot:source,outputDir:output,sourceCommit:PIN});
    assert.equal(a.sourceCommit,PIN);
    assert.equal(a.sourceFiles.length,17);
    assert.deepEqual(a.sourceFiles.map(f=>f.path),STAGING_SOURCE_FILES);
    assert.equal(existsSync(join(output,'netlify','do-not-deploy.txt')),false);
    const saved=JSON.parse(readFileSync(join(output,'pro-papa-staging-source-manifest.json')));
    assert.deepEqual(saved,a);
    for(const f of a.sourceFiles){
      const bytes=readFileSync(join(output,f.path));
      assert.equal(bytes.length,f.size);
      assert.equal(createHash('sha1').update(bytes).digest('hex'),f.sha1);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256);
    }
    const second=prepareVercelStagingSource({sourceRoot:source,outputDir:join(dir,'other'),sourceCommit:PIN});
    assert.deepEqual(second,a);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('staging exporter rejects in-checkout destinations, existing bundles and unknown commits',()=>{
  const {dir,source,output}=fixture();
  try{
    assert.throws(()=>prepareVercelStagingSource({sourceRoot:source,outputDir:join(source,'output'),sourceCommit:PIN}),/outside/);
    assert.throws(()=>prepareVercelStagingSource({sourceRoot:source,outputDir:output,sourceCommit:'main'}),/40-character/);
    prepareVercelStagingSource({sourceRoot:source,outputDir:output,sourceCommit:PIN});
    assert.throws(()=>prepareVercelStagingSource({sourceRoot:source,outputDir:output,sourceCommit:PIN}),/already exist/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('staging exporter refuses symbolic links and does not create output on validation failure',()=>{
  const {dir,source,output}=fixture();
  try{
    const path=join(source,'api','mcp.mjs');
    rmSync(path);
    symlinkSync(join(source,'package.json'),path);
    assert.throws(()=>prepareVercelStagingSource({sourceRoot:source,outputDir:output,sourceCommit:PIN}),/non-regular or linked/);
    assert.equal(existsSync(output),false);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
