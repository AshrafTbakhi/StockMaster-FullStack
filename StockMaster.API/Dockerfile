
# Build the ASP.NET Core 8 application
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["StockMaster.API.csproj", "./"]
RUN dotnet restore "StockMaster.API.csproj"

COPY . .
RUN dotnet publish "StockMaster.API.csproj" -c Release -o /app/publish --no-restore /p:UseAppHost=false

# Run the published application
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://0.0.0.0:10000
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 10000

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "StockMaster.API.dll"]
