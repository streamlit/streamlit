Set-Location C:\Users\Yash\Desktop\StreamLit

$protos = Get-ChildItem proto\streamlit\proto\*.proto | ForEach-Object {
    $_.FullName.Replace("$PWD\proto\", "").Replace("\", "/")
}

$args_list = @("--proto_path=proto", "--python_out=lib") + $protos

Write-Host "Compiling $($protos.Count) proto files..."
& python -m grpc_tools.protoc @args_list

if ($LASTEXITCODE -eq 0) {
    $count = (Get-ChildItem lib\streamlit\proto\*_pb2.py).Count
    Write-Host "Done. $count _pb2.py files generated in lib\streamlit\proto\"
} else {
    Write-Host "protoc exited with code $LASTEXITCODE"
}
